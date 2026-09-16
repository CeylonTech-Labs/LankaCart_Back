import { Response } from "express";

type SuccessResponseOptions<T> = {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
};

export const sendSuccess = <T>(
  res: Response,
  { statusCode = 200, message = "Success", data, meta }: SuccessResponseOptions<T>
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta
  });
};

export const sendError = (
  res: Response,
  statusCode = 500,
  message = "Something went wrong",
  details?: unknown
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    details
  });
};
