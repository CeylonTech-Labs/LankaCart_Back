import { UserRole } from "@prisma/client";
import { Router } from "express";
import { addToWishlist, getMyWishlist, removeFromWishlist } from "../controllers/wishlist.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.CUSTOMER));

router.get("/", getMyWishlist);
router.post("/:productId", addToWishlist);
router.delete("/:productId", removeFromWishlist);

export default router;
