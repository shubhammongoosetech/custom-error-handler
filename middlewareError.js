import { Request, Response, NextFunction } from "express";
import { HttpException } from "../utils";

export const GlobalErrorHandlerMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Check if the error is an instance of HttpException
  if (err instanceof HttpException) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
  }
  // { code: "UNKNOWN_ERROR", message: "Unexpected error" }
  return res.status(500).json({
    code: "UNKNOWN_ERROR",
    message: "Unexpected error.",
  });
};
