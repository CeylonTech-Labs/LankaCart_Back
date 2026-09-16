import { RequestHandler } from "express";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};
