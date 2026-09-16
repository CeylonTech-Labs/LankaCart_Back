import { RequestHandler } from "express";
import { AppError } from "../utils/errors";

const hits = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (limit = 180, windowMs = 15 * 60 * 1000): RequestHandler => {
  return (req, _res, next) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "anonymous";
    const now = Date.now();
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > limit) {
      return next(new AppError("Too many requests. Please try again later.", 429));
    }

    return next();
  };
};

const cleanString = (value: string) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === "string") return cleanString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)]));
  }
  return value;
};

export const sanitizeInput: RequestHandler = (req, _res, next) => {
  req.body = sanitizeValue(req.body) as typeof req.body;
  req.query = sanitizeValue(req.query) as typeof req.query;
  req.params = sanitizeValue(req.params) as typeof req.params;
  return next();
};
