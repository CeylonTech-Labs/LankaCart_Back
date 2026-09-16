import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";
import { notFoundHandler } from "./middlewares/not-found.middleware";
import { rateLimit, sanitizeInput } from "./middlewares/security.middleware";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit());
app.use(sanitizeInput);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to LankaCart API",
    version: "1.0.0"
  });
});

app.use("/api", routes);
app.use("/api/v1", routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
