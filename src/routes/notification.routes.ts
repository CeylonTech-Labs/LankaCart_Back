import { Router } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../controllers/marketplace.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/", listNotifications);
router.put("/read-all", markAllNotificationsRead);
router.put("/:id/read", markNotificationRead);

export default router;
