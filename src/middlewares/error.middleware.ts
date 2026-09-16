import { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { sendError } from "../utils/apiResponse";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.details);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return sendError(res, 409, "A record with this value already exists", error.meta);
    }

    if (error.code === "P2025") {
      return sendError(res, 404, "Requested record was not found", error.meta);
    }
  }

  console.error(error);

  return sendError(
    res,
    500,
    "Internal server error",
    env.NODE_ENV === "development" ? { message: error.message, stack: error.stack } : undefined
  );
};
