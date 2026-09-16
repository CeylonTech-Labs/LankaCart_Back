import { UserRole } from "@prisma/client";
import { Router } from "express";
import { generateProductDescription } from "../controllers/marketplace.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.SELLER, UserRole.ADMIN));
router.post("/generate-product-description", generateProductDescription);

export default router;
