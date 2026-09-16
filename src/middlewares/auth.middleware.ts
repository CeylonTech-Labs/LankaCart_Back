import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/errors";

export const authenticate: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Authentication token is required", 401));
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(new AppError("Invalid or expired authentication token", 401));
  }
};

export const authorizeRoles = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication is required", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to access this resource", 403));
    }

    return next();
  };
};
