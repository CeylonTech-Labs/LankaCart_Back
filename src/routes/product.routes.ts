import { Router } from "express";
import {
  getFeaturedProducts,
  getNewArrivals,
  getProduct,
  getProducts,
  getProductsByCategory,
  getTopSellingProducts,
  searchProducts
} from "../controllers/product.controller";
import { productReviews } from "../controllers/marketplace.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  categorySlugParamSchema,
  productQuerySchema,
  slugParamSchema
} from "../validations/catalog.validation";

const router = Router();

router.get("/", validate(productQuerySchema), getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/new-arrivals", getNewArrivals);
router.get("/top-selling", getTopSellingProducts);
router.get("/search", validate(productQuerySchema), searchProducts);
router.get("/category/:categorySlug", validate(categorySlugParamSchema), getProductsByCategory);
router.get("/:productId/reviews", productReviews);
router.get("/:slug", validate(slugParamSchema), getProduct);

export default router;
