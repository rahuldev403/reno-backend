-- =================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. PROFILES POLICIES
-- =================================================================
-- Users can only read and update their own profiles.

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- =================================================================
-- 3. STORES POLICIES
-- =================================================================
-- Anyone (including customers) can view stores.
-- Only the SELLER who owns the store can manage it.

CREATE POLICY "Anyone can view stores" 
ON public.stores FOR SELECT 
USING (true);

CREATE POLICY "Sellers can manage own store" 
ON public.stores FOR ALL 
USING (auth.uid() = seller_id);

-- =================================================================
-- 4. PRODUCTS POLICIES
-- =================================================================
-- Customers can view unarchived products.
-- Sellers can do EVERYTHING (CRUD) but ONLY to products in their own store.

CREATE POLICY "Anyone can view unarchived products" 
ON public.products FOR SELECT 
USING (is_archived = false);

CREATE POLICY "Sellers can manage own products" 
ON public.products FOR ALL 
USING (
    store_id IN (
        SELECT id FROM public.stores WHERE seller_id = auth.uid()
    )
);

-- =================================================================
-- 5. INVENTORY POLICIES
-- =================================================================
-- Sellers can view their own inventory. 
-- Modifications (deducting stock) will be handled by the backend 
-- using the service_role key to ensure concurrency locks hold.

CREATE POLICY "Sellers can view own inventory" 
ON public.inventory FOR SELECT 
USING (
    product_id IN (
        SELECT id FROM public.products 
        WHERE store_id IN (
            SELECT id FROM public.stores WHERE seller_id = auth.uid()
        )
    )
);

-- =================================================================
-- 6. ORDERS & ORDER ITEMS POLICIES
-- =================================================================
-- Customers can view their own orders.
-- Sellers can view orders placed at their store.
-- Inserts/Updates are strictly handled by the Node.js backend.

CREATE POLICY "Customers can view own orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Sellers can view store orders" 
ON public.orders FOR SELECT 
USING (
    store_id IN (
        SELECT id FROM public.stores WHERE seller_id = auth.uid()
    )
);

CREATE POLICY "Customers can view own order items" 
ON public.order_items FOR SELECT 
USING (
    order_id IN (
        SELECT id FROM public.orders WHERE customer_id = auth.uid()
    )
);

CREATE POLICY "Sellers can view store order items" 
ON public.order_items FOR SELECT 
USING (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE store_id IN (
            SELECT id FROM public.stores WHERE seller_id = auth.uid()
        )
    )
);