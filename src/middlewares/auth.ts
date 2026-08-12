import { Request, Response, NextFunction } from "express";
import { supabase, supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

// Extend Express Request to include the validated user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: "SELLER" | "CUSTOMER";
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Missing or invalid authorization header");
    }

    const token = authHeader.split(" ")[1];
    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      throw new ApiError(401, "Unauthenticated");
    }
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(401, "User profile not found");
    }
    req.user = {
      id: authData.user.id,
      role: profile.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (role: "SELLER" | "CUSTOMER") => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthenticated"));
    }

    if (req.user.role !== role) {
      return next(new ApiError(403, "Forbidden: Insufficient permissions"));
    }

    next();
  };
};
