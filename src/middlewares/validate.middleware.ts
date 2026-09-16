import { RequestHandler } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../utils/errors";

export const validate = (schema: ZodSchema): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return next(new AppError("Validation failed", 422, result.error.flatten()));
    }

    req.body = result.data.body ?? req.body;
    req.params = result.data.params ?? req.params;
    Object.defineProperty(req, "query", {
      value: result.data.query ?? req.query,
      writable: true
    });

    return next();
  };
};
