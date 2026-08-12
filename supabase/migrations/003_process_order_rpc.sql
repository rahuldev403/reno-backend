CREATE OR REPLACE FUNCTION process_order(
    p_customer_id UUID,
    p_idempotency_key TEXT,
    p_items JSONB -- Expected format: [{"product_id": "uuid", "quantity": 1}]
) RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_store_id UUID;
    v_total_amount BIGINT := 0;
    v_item RECORD;
    v_product RECORD;
    v_stock INT;
    v_existing_order UUID;
BEGIN
    -- 1. Idempotency Check (B2): Prevent duplicate orders from network retries
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_order FROM public.orders WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('status', 'success', 'order_id', v_existing_order, 'message', 'Idempotent return');
        END IF;
    END IF;

    -- Create a temporary table to hold parsed JSON items
    CREATE TEMP TABLE temp_items (
        product_id UUID,
        quantity INT
    ) ON COMMIT DROP;

    INSERT INTO temp_items
    SELECT (value->>'product_id')::UUID, (value->>'quantity')::INT
    FROM jsonb_array_elements(p_items);

    -- 2. Verify all products belong to the SAME store and calculate totals (A5)
    -- We deliberately ignore any price the client might have sent.
    FOR v_item IN SELECT * FROM temp_items LOOP
        -- Fetch true product details
        SELECT store_id, price_amount INTO v_product 
        FROM public.products 
        WHERE id = v_item.product_id AND is_archived = false;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found or is archived', v_item.product_id;
        END IF;

        IF v_store_id IS NULL THEN
            v_store_id := v_product.store_id;
        ELSIF v_store_id != v_product.store_id THEN
            RAISE EXCEPTION 'All items in a single order must belong to the same store';
        END IF;

        v_total_amount := v_total_amount + (v_product.price_amount * v_item.quantity);

        -- 3. Concurrent Stock Lock (B1)
        -- 'FOR UPDATE' locks this specific inventory row. If a simultaneous request hits this, 
        -- it waits here until the first transaction finishes.
        SELECT quantity INTO v_stock 
        FROM public.inventory 
        WHERE product_id = v_item.product_id 
        FOR UPDATE;

        IF v_stock < v_item.quantity THEN
            RAISE EXCEPTION 'OUT_OF_STOCK'; -- Will trigger a 409 in our API
        END IF;

        -- Deduct stock
        UPDATE public.inventory 
        SET quantity = quantity - v_item.quantity, updated_at = NOW()
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- 4. Insert Order
    INSERT INTO public.orders (customer_id, store_id, total_amount, idempotency_key)
    VALUES (p_customer_id, v_store_id, v_total_amount, p_idempotency_key)
    RETURNING id INTO v_order_id;

    -- 5. Insert Order Items
    FOR v_item IN SELECT * FROM temp_items LOOP
        SELECT price_amount INTO v_product.price_amount FROM public.products WHERE id = v_item.product_id;
        
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_product.price_amount);
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'order_id', v_order_id);
EXCEPTION
    WHEN OTHERS THEN
        -- If anything fails, the entire transaction rolls back automatically
        IF SQLERRM = 'OUT_OF_STOCK' THEN
            RAISE EXCEPTION 'OUT_OF_STOCK';
        ELSE
            RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
        END IF;
END;
$$ LANGUAGE plpgsql;