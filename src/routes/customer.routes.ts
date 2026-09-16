import { UserRole } from "@prisma/client";
import { Router } from "express";
import {
  createAddress,
  getAddresses,
  removeAddress,
  setDefaultAddress,
  updateAddress
} from "../controllers/address.controller";
import {
  createCustomerReturn,
  createReview,
  customerCancelOrder,
  customerDashboardAnalytics,
  customerOrderDetail,
  customerOrders,
  customerReturnRequestForOrder,
  customerReturns,
  customerSupportTickets,
  customerTracking,
  createSupportTicket
} from "../controllers/marketplace.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  addressIdParamSchema,
  createAddressSchema,
  updateAddressSchema
} from "../validations/address.validation";

const router = Router();

router.use(authenticate, authorizeRoles(UserRole.CUSTOMER));

router.get("/dashboard/stats", customerDashboardAnalytics);

router.get("/orders", customerOrders);
router.get("/orders/:id", customerOrderDetail);
router.put("/orders/:id/cancel", customerCancelOrder);
router.post("/orders/:id/return-request", customerReturnRequestForOrder);
router.get("/orders/:id/tracking", customerTracking);

router.get("/returns", customerReturns);
router.post("/returns", createCustomerReturn);

router.post("/reviews", createReview);

router.post("/support-tickets", createSupportTicket);
router.get("/support-tickets", customerSupportTickets);

router.get("/addresses", getAddresses);
router.post("/addresses", validate(createAddressSchema), createAddress);
router.put("/addresses/:id", validate(updateAddressSchema), updateAddress);
router.delete("/addresses/:id", validate(addressIdParamSchema), removeAddress);
router.put("/addresses/:id/default", validate(addressIdParamSchema), setDefaultAddress);

export default router;
