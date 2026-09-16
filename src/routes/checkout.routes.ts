import { UserRole } from "@prisma/client";
import { Router } from "express";
import { applyCoupon, checkoutSummary, placeOrder } from "../controllers/marketplace.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.CUSTOMER));
router.get("/summary", checkoutSummary);
router.post("/apply-coupon", applyCoupon);
router.post("/place-order", placeOrder);

export default router;
