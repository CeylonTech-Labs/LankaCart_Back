import { UserRole } from "@prisma/client";
import { Router } from "express";
import {
  createAdminBrand,
  deleteAdminBrand,
  updateAdminBrand
} from "../controllers/brand.controller";
import {
  createAdminCategory,
  deleteAdminCategory,
  updateAdminCategory
} from "../controllers/category.controller";
import {
  approveSeller,
  dashboardStats,
  deleteUser,
  getPendingSellers,
  getSeller,
  getSellers,
  getUser,
  getUsers,
  rejectSeller,
  setUserStatus,
  suspendSeller
} from "../controllers/admin.controller";
import {
  approveProduct,
  deleteProductAsAdmin,
  featureProduct,
  getAdminProducts,
  getPendingProducts,
  rejectProduct
} from "../controllers/product.controller";
import {
  addFlashSaleProduct,
  adminBlogs,
  adminCoupons,
  adminDashboardAnalytics,
  adminFlashSales,
  adminOrderDetail,
  adminOrders,
  adminPages,
  adminReturnDetail,
  adminReturns,
  adminReviews,
  adminSupportTicketDetail,
  adminSupportTickets,
  approveRefund,
  approveReturn,
  completeRefund,
  completeReturn,
  createBanner,
  createBlog,
  createCoupon,
  createFlashSale,
  createPage,
  createShipment,
  deleteBanner,
  deleteBlog,
  deleteCoupon,
  deleteFlashSale,
  deleteOrder,
  deletePage,
  deleteReview,
  getPayment,
  getRefund,
  getShipment,
  hideReview,
  listPayments,
  listRefunds,
  listShipments,
  publicBanners,
  rejectRefund,
  rejectReturn,
  removeFlashSaleProduct,
  replySupportTicket,
  sendAdminNotification,
  updateBanner,
  updateBlog,
  updateCoupon,
  updateFlashSale,
  updateOrderStatus,
  updatePage,
  updatePaymentStatus,
  updateShipmentStatus,
  updateSupportTicketStatus
} from "../controllers/marketplace.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  rejectSellerSchema,
  sellerIdParamSchema,
  updateUserStatusSchema,
  userIdParamSchema
} from "../validations/admin.validation";
import {
  createBrandSchema,
  createCategorySchema,
  idParamSchema,
  updateBrandSchema,
  updateCategorySchema
} from "../validations/catalog.validation";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.ADMIN));

router.get("/dashboard/stats", dashboardStats);
router.get("/dashboard/analytics", adminDashboardAnalytics);

router.get("/orders", adminOrders);
router.get("/orders/:id", adminOrderDetail);
router.put("/orders/:id/status", updateOrderStatus);
router.delete("/orders/:id", deleteOrder);

router.get("/payments", listPayments);
router.get("/payments/:id", getPayment);
router.put("/payments/:id/status", updatePaymentStatus);

router.post("/shipments", createShipment);
router.get("/shipments", listShipments);
router.get("/shipments/:id", getShipment);
router.put("/shipments/:id/status", updateShipmentStatus);

router.get("/returns", adminReturns);
router.get("/returns/:id", adminReturnDetail);
router.put("/returns/:id/approve", approveReturn);
router.put("/returns/:id/reject", rejectReturn);
router.put("/returns/:id/complete", completeReturn);

router.get("/refunds", listRefunds);
router.get("/refunds/:id", getRefund);
router.put("/refunds/:id/approve", approveRefund);
router.put("/refunds/:id/reject", rejectRefund);
router.put("/refunds/:id/complete", completeRefund);

router.post("/coupons", createCoupon);
router.get("/coupons", adminCoupons);
router.put("/coupons/:id", updateCoupon);
router.delete("/coupons/:id", deleteCoupon);

router.post("/flash-sales", createFlashSale);
router.get("/flash-sales", adminFlashSales);
router.put("/flash-sales/:id", updateFlashSale);
router.delete("/flash-sales/:id", deleteFlashSale);
router.post("/flash-sales/:id/products", addFlashSaleProduct);
router.delete("/flash-sales/:id/products/:productId", removeFlashSaleProduct);

router.post("/banners", createBanner);
router.get("/banners", publicBanners);
router.put("/banners/:id", updateBanner);
router.delete("/banners/:id", deleteBanner);

router.post("/pages", createPage);
router.get("/pages", adminPages);
router.put("/pages/:id", updatePage);
router.delete("/pages/:id", deletePage);

router.post("/blogs", createBlog);
router.get("/blogs", adminBlogs);
router.put("/blogs/:id", updateBlog);
router.delete("/blogs/:id", deleteBlog);

router.get("/reviews", adminReviews);
router.put("/reviews/:id/hide", hideReview);
router.delete("/reviews/:id", deleteReview);

router.get("/support-tickets", adminSupportTickets);
router.get("/support-tickets/:id", adminSupportTicketDetail);
router.post("/support-tickets/:id/reply", replySupportTicket);
router.put("/support-tickets/:id/status", updateSupportTicketStatus);

router.post("/notifications/send", sendAdminNotification);

router.post("/categories", validate(createCategorySchema), createAdminCategory);
router.put("/categories/:id", validate(updateCategorySchema), updateAdminCategory);
router.delete("/categories/:id", validate(idParamSchema), deleteAdminCategory);

router.post("/brands", validate(createBrandSchema), createAdminBrand);
router.put("/brands/:id", validate(updateBrandSchema), updateAdminBrand);
router.delete("/brands/:id", validate(idParamSchema), deleteAdminBrand);

router.get("/products", getAdminProducts);
router.get("/products/pending", getPendingProducts);
router.put("/products/:id/approve", validate(idParamSchema), approveProduct);
router.put("/products/:id/reject", validate(idParamSchema), rejectProduct);
router.put("/products/:id/feature", validate(idParamSchema), featureProduct);
router.delete("/products/:id", validate(idParamSchema), deleteProductAsAdmin);

router.get("/users", getUsers);
router.get("/users/:id", validate(userIdParamSchema), getUser);
router.put("/users/:id/status", validate(updateUserStatusSchema), setUserStatus);
router.delete("/users/:id", validate(userIdParamSchema), deleteUser);

router.get("/sellers", getSellers);
router.get("/sellers/pending", getPendingSellers);
router.get("/sellers/:id", validate(sellerIdParamSchema), getSeller);
router.put("/sellers/:id/approve", validate(sellerIdParamSchema), approveSeller);
router.put("/sellers/:id/reject", validate(rejectSellerSchema), rejectSeller);
router.put("/sellers/:id/suspend", validate(sellerIdParamSchema), suspendSeller);

export default router;
