import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { title, description, category, price_amount, currency } = req.body;
    const sellerId = req.user?.id;
    if (!title || !category || price_amount === undefined) {
      throw new ApiError(400, "Title,category,and price_amount are required");
    }
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("seller_id", sellerId)
      .single();
    if (storeError || !store) {
      throw new ApiError(404, "Store not found for this seller");
    }
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        title,
        description,
        category,
        price_amount,
        currency: currency || "XAF",
      })
      .select()
      .single();

    if (productError) throw new ApiError(500, productError.message);

    const { error: inventoryError } = await supabase
      .from("inventory")
      .insert({ product_id: product.id, quanity: 0 });
    if (inventoryError) throw new ApiError(500, inventoryError.message);
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = "1",
      limit = "20",
      serach,
      category,
      min_price,
      max_price,
      available,
      sort = "create_at",
      order = "desc",
    } = req.body;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from("products")
      .select(
        `*,
        inventory ( quantity )`,
        { count: "exact" },
      )
      .eq("is_archived", false);

    if (search) {
      query = query.textSearch("title", search as string, {
        type: "websearch",
        config: "english",
      });
    }
    if (category) query = query.eq("category", category as string);
    if (min_price)
      query = query.gte("price_amount", parseInt(min_price as string, 10));
    if (max_price)
      query = query.lte("price_amount", parseInt(max_price as string, 10));

    if (available === "true") {
      query = query.gt("inventory.quantity", 0);
    }

    query = query.order(sort as string, { ascending: order === "asc" });
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw new ApiError(500, error.message);

    res.status(200).json({
      data,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        total_pages: count ? Math.ceil(count / limitNum) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    if (!data) throw new ApiError(404, "Product not found or unauthorized");

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const { error, count } = await supabase
      .from("products")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new ApiError(500, error.message);
    if (count === 0)
      throw new ApiError(404, "Product not found or unauthorized");

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
