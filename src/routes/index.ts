import { Router } from "express";
import aiRoutes from "./ai.routes";
import adminRoutes from "./admin.routes";
import authRoutes from "./auth.routes";
import brandRoutes from "./brand.routes";
import cartRoutes from "./cart.routes";
import categoryRoutes from "./category.routes";
import checkoutRoutes from "./checkout.routes";
import customerRoutes from "./customer.routes";
import healthRoutes from "./health.routes";
import notificationRoutes from "./notification.routes";
import productRoutes from "./product.routes";
import {
  bannerRoutes,
  blogRoutes,
  couponRoutes,
  flashSaleRoutes,
  pageRoutes,
  searchRoutes
} from "./public-marketplace.routes";
import sellerRoutes from "./seller.routes";
import wishlistRoutes from "./wishlist.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/coupons", couponRoutes);
router.use("/flash-sales", flashSaleRoutes);
router.use("/banners", bannerRoutes);
router.use("/pages", pageRoutes);
router.use("/blogs", blogRoutes);
router.use("/notifications", notificationRoutes);
router.use("/ai", aiRoutes);
router.use("/search", searchRoutes);
router.use("/admin", adminRoutes);
router.use("/customer", customerRoutes);
router.use("/seller", sellerRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);

export default router;
