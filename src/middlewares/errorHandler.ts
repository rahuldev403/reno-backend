import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        status: err.statusCode,
        message: err.message,
      },
    });
  }

  console.error("[Unhandled Server Error]:", err);
  return res.status(500).json({
    error: {
      status: 500,
      message: "Internal server error",
    },
  });
};
