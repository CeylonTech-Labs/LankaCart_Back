import { UserRole } from "@prisma/client";
import { Router } from "express";
import {
  createProductForSeller,
  deleteProductForSeller,
  deleteSellerProductImage,
  getSellerProductById,
  getSellerProductList,
  updateProductForSeller,
  uploadSellerProductImages
} from "../controllers/product.controller";
import {
  generateProductDescription,
  sellerOrderDetail,
  sellerOrders,
  sellerOrderStats,
  sellerReviews,
  sellerUpdateOrderStatus
} from "../controllers/marketplace.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  idParamSchema,
  imageIdParamSchema,
  updateProductSchema
} from "../validations/catalog.validation";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.SELLER));

router.get("/orders/stats", sellerOrderStats);
router.get("/orders", sellerOrders);
router.get("/orders/:id", sellerOrderDetail);
router.put("/orders/:id/status", sellerUpdateOrderStatus);
router.get("/reviews", sellerReviews);
router.post("/ai/generate-product-description", generateProductDescription);

router.post("/products", validate(createProductSchema), createProductForSeller);
router.get("/products", getSellerProductList);
router.get("/products/:id", validate(idParamSchema), getSellerProductById);
router.put("/products/:id", validate(updateProductSchema), updateProductForSeller);
router.delete("/products/:id", validate(idParamSchema), deleteProductForSeller);
router.post("/products/:id/images", validate(idParamSchema), upload.array("images", 8), uploadSellerProductImages);
router.delete("/products/images/:imageId", validate(imageIdParamSchema), deleteSellerProductImage);

export default router;
