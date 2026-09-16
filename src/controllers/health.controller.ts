import { RequestHandler } from "express";
import { sendSuccess } from "../utils/apiResponse";

export const healthCheck: RequestHandler = (_req, res) => {
  return sendSuccess(res, {
    message: "LankaCart API is healthy",
    data: {
      service: "lankacart-api",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
};
