import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { supabase } from "../config/supabase";
import { orderEvents } from "../services/events";

export const createOrder = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { items } = req.body;
    const customerId = req.user?.id;
    const idempotencyKey = req.headers["x-idempotency-key"] as string;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "Invalid items payload");
    }
    if (!idempotencyKey) {
      throw new ApiError(400, "Missing x-idempotency-key header");
    }
    const payloadItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc("process_order", {
      p_customer_id: customerId,
      p_idempotency_key: idempotencyKey,
      p_items: payloadItems,
    });

    if (error) {
      if (error.message.includes("OUT_OF_STOCK")) {
        throw new ApiError(409, "Conflict: One or more items are out of stock");
      }
      throw new ApiError(400, error.message);
    }
    orderEvents.emit("ORDER_CREATED", {
      orderId: data.order_id,
      timeStamp: new Date().toISOString(),
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};
