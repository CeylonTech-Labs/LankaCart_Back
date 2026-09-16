import { UserRole } from "@prisma/client";
import { Router } from "express";
import {
  addItemToCart,
  clearMyCart,
  deleteItemFromCart,
  getMyCart,
  updateItemInCart
} from "../controllers/cart.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { cartItemSchema, idParamSchema, updateCartItemSchema } from "../validations/catalog.validation";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.CUSTOMER));

router.get("/", getMyCart);
router.post("/items", validate(cartItemSchema), addItemToCart);
router.put("/items/:id", validate(updateCartItemSchema), updateItemInCart);
router.delete("/items/:id", validate(idParamSchema), deleteItemFromCart);
router.delete("/clear", clearMyCart);

export default router;
