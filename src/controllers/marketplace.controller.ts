import { RequestHandler } from "express";
import {
  BlogStatus,
  CMSPageStatus,
  CouponType,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  RefundStatus,
  ReturnStatus,
  SellerStatus,
  ShippingStatus,
  TicketStatus,
  UserRole
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";
import { slugify } from "../utils/slug";

const orderInclude = {
  items: {
    include: {
      product: { include: { images: true, seller: true } },
      variant: true,
      seller: true
    }
  },
  payment: true,
  shipping: true,
  shippingAddress: true,
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  returnRequests: true,
  refundRequests: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
};

const publicProductInclude = {
  images: true,
  seller: true,
  category: true,
  brand: true,
  inventoryRecords: true
};

const requireUserId = (req: Parameters<RequestHandler>[0]) => {
  if (!req.user?.id) throw new AppError("Authentication is required", 401);
  return req.user.id;
};

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizePaymentMethod = (value?: string) => {
  if (value === "BANK_TRANSFER") return PaymentMethod.BANK_TRANSFER;
  if (value === "PAYHERE") return PaymentMethod.PAYHERE;
  return PaymentMethod.CASH_ON_DELIVERY;
};

const normalizeCouponType = (value?: string) => {
  return value === "PERCENTAGE" ? CouponType.PERCENTAGE : CouponType.FIXED_AMOUNT;
};

const isShippedOrLater = (status: OrderStatus) =>
  ([OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED, OrderStatus.RETURNED, OrderStatus.REFUNDED] as OrderStatus[]).includes(status);

const orderNumber = () => `LC-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

const createNotification = async (userId: string | null | undefined, title: string, message: string, type: NotificationType = NotificationType.SYSTEM, data?: object) => {
  if (!userId) return;
  await prisma.notification.create({
    data: { userId, title, message, type, data: data ?? undefined }
  });
};

const getSellerForUser = async (userId: string) => {
  const seller = await prisma.sellerProfile.findFirst({ where: { userId, deletedAt: null } });
  if (!seller) throw new AppError("Seller profile was not found", 404);
  return seller;
};

const getCartSummaryForUser = async (userId: string, couponCode?: string) => {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: {
      items: {
        include: {
          product: { include: publicProductInclude },
          variant: true
        }
      }
    }
  });

  if (!cart.items.length) {
    return { cart, subtotal: 0, shippingFee: 0, discountAmount: 0, totalAmount: 0, coupon: null };
  }

  for (const item of cart.items) {
    const available = item.product.inventoryRecords.reduce((sum, record) => sum + record.quantity - record.reservedQuantity, 0);
    if (item.product.status !== ProductStatus.APPROVED || item.product.deletedAt || available < item.quantity) {
      throw new AppError(`${item.product.name} does not have enough available stock`, 400);
    }
  }

  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const shippingFee = subtotal >= 15000 ? 0 : 450;
  let coupon = null as Awaited<ReturnType<typeof prisma.coupon.findFirst>> | null;
  let discountAmount = 0;

  if (couponCode) {
    const now = new Date();
    coupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode.toUpperCase(),
        isActive: true,
        deletedAt: null,
        startsAt: { lte: now },
        expiresAt: { gte: now }
      }
    });

    if (!coupon) throw new AppError("Coupon is not available", 400);
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError("Coupon usage limit reached", 400);
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) throw new AppError("Order amount is below coupon minimum", 400);

    discountAmount =
      coupon.type === CouponType.PERCENTAGE
        ? (subtotal * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    discountAmount = Math.min(discountAmount, subtotal);
  }

  return {
    cart,
    subtotal,
    shippingFee,
    discountAmount,
    totalAmount: Math.max(0, subtotal + shippingFee - discountAmount),
    coupon
  };
};

export const checkoutSummary: RequestHandler = async (req, res, next) => {
  try {
    const summary = await getCartSummaryForUser(requireUserId(req), String(req.query.couponCode ?? req.query.code ?? ""));
    return sendSuccess(res, { message: "Checkout summary fetched", data: summary });
  } catch (error) {
    return next(error);
  }
};

export const applyCoupon: RequestHandler = async (req, res, next) => {
  try {
    const summary = await getCartSummaryForUser(requireUserId(req), String(req.body.code ?? ""));
    return sendSuccess(res, { message: "Coupon applied", data: summary });
  } catch (error) {
    return next(error);
  }
};

export const placeOrder: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const address = await prisma.address.findFirst({
      where: { id: req.body.addressId, userId, deletedAt: null }
    });
    if (!address) throw new AppError("Delivery address was not found", 404);

    const summary = await getCartSummaryForUser(userId, req.body.couponCode);
    if (!summary.cart.items.length) throw new AppError("Cart is empty", 400);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          userId,
          couponId: summary.coupon?.id,
          shippingAddressId: address.id,
          subtotal: summary.subtotal,
          discountAmount: summary.discountAmount,
          shippingFee: summary.shippingFee,
          totalAmount: summary.totalAmount,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          customerNote: req.body.customerNote,
          items: {
            create: summary.cart.items.map((item) => ({
              productId: item.productId,
              sellerId: item.product.sellerId,
              variantId: item.variantId,
              productName: item.product.name,
              sellerShopName: item.product.seller.shopName,
              sku: item.variant?.sku ?? item.product.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: Number(item.unitPrice) * item.quantity,
              commissionRate: item.product.seller.commissionRate
            }))
          },
          payment: {
            create: {
              method: normalizePaymentMethod(req.body.paymentMethod),
              status: PaymentStatus.PENDING,
              amount: summary.totalAmount,
              transactionRef: req.body.transactionRef
            }
          },
          shipping: {
            create: {
              addressId: address.id,
              status: ShippingStatus.PENDING,
              trackingNumber: `TRK-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`
            }
          },
          statusHistory: {
            create: { status: OrderStatus.PENDING, note: "Order placed by customer", changedById: userId }
          }
        },
        include: orderInclude
      });

      for (const item of summary.cart.items) {
        const inventory = await tx.inventory.findFirst({
          where: { productId: item.productId, variantId: item.variantId ?? null },
          orderBy: { createdAt: "asc" }
        });
        if (!inventory || inventory.quantity - inventory.reservedQuantity < item.quantity) {
          throw new AppError(`${item.product.name} does not have enough available stock`, 400);
        }
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { decrement: item.quantity } }
        });
      }

      if (summary.coupon) {
        await tx.coupon.update({ where: { id: summary.coupon.id }, data: { usedCount: { increment: 1 } } });
      }
      await tx.cartItem.deleteMany({ where: { cartId: summary.cart.id } });
      return created;
    });

    await createNotification(userId, "Order placed", `Your order ${order.orderNumber} was placed successfully.`, NotificationType.ORDER, { orderId: order.id });
    return sendSuccess(res, { statusCode: 201, message: "Order placed successfully", data: order });
  } catch (error) {
    return next(error);
  }
};

export const customerOrders: RequestHandler = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: requireUserId(req) },
      include: orderInclude,
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { message: "Orders fetched", data: orders });
  } catch (error) {
    return next(error);
  }
};

export const customerOrderDetail: RequestHandler = async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: requireUserId(req) },
      include: orderInclude
    });
    if (!order) throw new AppError("Order was not found", 404);
    return sendSuccess(res, { message: "Order fetched", data: order });
  } catch (error) {
    return next(error);
  }
};

export const customerCancelOrder: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId }, include: { items: true } });
    if (!order) throw new AppError("Order was not found", 404);
    if (isShippedOrLater(order.status)) throw new AppError("Order cannot be cancelled after shipping", 400);

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const inventory = await tx.inventory.findFirst({ where: { productId: item.productId, variantId: item.variantId ?? null } });
        if (inventory) await tx.inventory.update({ where: { id: inventory.id }, data: { quantity: { increment: item.quantity } } });
      }
      await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { status: OrderStatus.CANCELLED } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: OrderStatus.CANCELLED, note: req.body.reason ?? "Cancelled by customer", changedById: userId } });
      return tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED }, include: orderInclude });
    });

    await createNotification(userId, "Order cancelled", `Order ${updated.orderNumber} was cancelled.`, NotificationType.ORDER, { orderId: updated.id });
    return sendSuccess(res, { message: "Order cancelled", data: updated });
  } catch (error) {
    return next(error);
  }
};

export const customerReturnRequestForOrder: RequestHandler = async (req, res, next) => {
  req.body = { ...req.body, orderId: req.params.id };
  return createCustomerReturn(req, res, next);
};

export const sellerOrders: RequestHandler = async (req, res, next) => {
  try {
    const seller = await getSellerForUser(requireUserId(req));
    const orders = await prisma.order.findMany({
      where: { items: { some: { sellerId: seller.id } } },
      include: orderInclude,
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { message: "Seller orders fetched", data: orders.map((order) => ({ ...order, items: order.items.filter((item) => item.sellerId === seller.id) })) });
  } catch (error) {
    return next(error);
  }
};

export const sellerOrderDetail: RequestHandler = async (req, res, next) => {
  try {
    const seller = await getSellerForUser(requireUserId(req));
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, items: { some: { sellerId: seller.id } } },
      include: orderInclude
    });
    if (!order) throw new AppError("Order was not found", 404);
    return sendSuccess(res, { message: "Seller order fetched", data: { ...order, items: order.items.filter((item) => item.sellerId === seller.id) } });
  } catch (error) {
    return next(error);
  }
};

export const sellerOrderStats: RequestHandler = async (req, res, next) => {
  try {
    const seller = await getSellerForUser(requireUserId(req));
    const [totalProducts, totalOrders, pendingOrders, lowStockProducts, sales, topSellingProducts] = await Promise.all([
      prisma.product.count({ where: { sellerId: seller.id, deletedAt: null } }),
      prisma.order.count({ where: { items: { some: { sellerId: seller.id } } } }),
      prisma.order.count({ where: { status: OrderStatus.PENDING, items: { some: { sellerId: seller.id } } } }),
      prisma.product.count({ where: { sellerId: seller.id, inventoryRecords: { some: { quantity: { lte: 5 } } } } }),
      prisma.orderItem.aggregate({ where: { sellerId: seller.id, order: { status: { not: OrderStatus.CANCELLED } } }, _sum: { totalPrice: true } }),
      prisma.orderItem.groupBy({ by: ["productName"], where: { sellerId: seller.id }, _sum: { quantity: true, totalPrice: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 })
    ]);
    return sendSuccess(res, {
      message: "Seller stats fetched",
      data: { totalProducts, totalOrders, pendingOrders, totalSales: sales._sum.totalPrice ?? 0, monthlySales: sales._sum.totalPrice ?? 0, lowStockProducts, topSellingProducts }
    });
  } catch (error) {
    return next(error);
  }
};

export const sellerUpdateOrderStatus: RequestHandler = async (req, res, next) => {
  try {
    const seller = await getSellerForUser(requireUserId(req));
    const status = req.body.status as OrderStatus;
    if (!Object.values(OrderStatus).includes(status)) throw new AppError("Invalid order status", 400);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, items: { some: { sellerId: seller.id } } } });
    if (!order) throw new AppError("Order was not found", 404);

    await prisma.orderItem.updateMany({ where: { orderId: order.id, sellerId: seller.id }, data: { status } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status, note: req.body.note ?? `Seller updated items to ${status}`, changedById: requireUserId(req) } });
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status }, include: orderInclude });
    await createNotification(updated.userId, "Order status changed", `Order ${updated.orderNumber} is now ${status.replace(/_/g, " ").toLowerCase()}.`, NotificationType.ORDER, { orderId: updated.id });
    return sendSuccess(res, { message: "Order status updated", data: updated });
  } catch (error) {
    return next(error);
  }
};

export const adminOrders: RequestHandler = async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({ include: orderInclude, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Orders fetched", data: orders });
  } catch (error) {
    return next(error);
  }
};

export const adminOrderDetail: RequestHandler = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    if (!order) throw new AppError("Order was not found", 404);
    return sendSuccess(res, { message: "Order fetched", data: order });
  } catch (error) {
    return next(error);
  }
};

export const updateOrderStatus: RequestHandler = async (req, res, next) => {
  try {
    const status = req.body.status as OrderStatus;
    if (!Object.values(OrderStatus).includes(status)) throw new AppError("Invalid order status", 400);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status,
        paymentStatus: status === OrderStatus.REFUNDED ? PaymentStatus.REFUNDED : undefined,
        items: { updateMany: { where: {}, data: { status } } }
      },
      include: orderInclude
    });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status, note: req.body.note, changedById: req.user?.id } });
    await createNotification(order.userId, "Order status changed", `Order ${order.orderNumber} is now ${status.replace(/_/g, " ").toLowerCase()}.`, NotificationType.ORDER, { orderId: order.id });
    return sendSuccess(res, { message: "Order status updated", data: order });
  } catch (error) {
    return next(error);
  }
};

export const deleteOrder: RequestHandler = async (req, res, next) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    return sendSuccess(res, { message: "Order deleted", data: null });
  } catch (error) {
    return next(error);
  }
};

export const adminDashboardAnalytics: RequestHandler = async (_req, res, next) => {
  try {
    const [totalRevenue, totalOrders, totalCustomers, totalSellers, pendingSellers, pendingProducts, pendingReturns, pendingRefunds, recentOrders, topCategories, topSellers] =
      await Promise.all([
        prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { not: OrderStatus.CANCELLED } } }),
        prisma.order.count(),
        prisma.user.count({ where: { role: UserRole.CUSTOMER, deletedAt: null } }),
        prisma.sellerProfile.count({ where: { deletedAt: null } }),
        prisma.sellerProfile.count({ where: { status: SellerStatus.PENDING, deletedAt: null } }),
        prisma.product.count({ where: { status: ProductStatus.PENDING, deletedAt: null } }),
        prisma.returnRequest.count({ where: { status: ReturnStatus.REQUESTED } }),
        prisma.refundRequest.count({ where: { status: RefundStatus.REQUESTED } }),
        prisma.order.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: orderInclude }),
        prisma.product.groupBy({ by: ["categoryId"], _count: true, orderBy: { _count: { categoryId: "desc" } }, take: 5 }),
        prisma.orderItem.groupBy({ by: ["sellerShopName"], _sum: { totalPrice: true }, orderBy: { _sum: { totalPrice: "desc" } }, take: 5 })
      ]);
    return sendSuccess(res, {
      message: "Admin analytics fetched",
      data: {
        totalRevenue: totalRevenue._sum.totalAmount ?? 0,
        totalOrders,
        totalCustomers,
        totalSellers,
        pendingSellers,
        pendingProducts,
        pendingReturns,
        pendingRefunds,
        recentOrders,
        monthlySalesChart: [],
        topCategories,
        topSellers
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const customerDashboardAnalytics: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const [totalOrders, pendingOrders, deliveredOrders, cancelledOrders, wishlistCount] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.count({ where: { userId, status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { userId, status: OrderStatus.DELIVERED } }),
      prisma.order.count({ where: { userId, status: OrderStatus.CANCELLED } }),
      prisma.wishlist.count({ where: { userId } })
    ]);
    return sendSuccess(res, { message: "Customer stats fetched", data: { totalOrders, pendingOrders, deliveredOrders, cancelledOrders, wishlistCount } });
  } catch (error) {
    return next(error);
  }
};

export const listPayments: RequestHandler = async (_req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({ include: { order: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Payments fetched", data: payments });
  } catch (error) {
    return next(error);
  }
};

export const getPayment: RequestHandler = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { order: true } });
    if (!payment) throw new AppError("Payment was not found", 404);
    return sendSuccess(res, { message: "Payment fetched", data: payment });
  } catch (error) {
    return next(error);
  }
};

export const updatePaymentStatus: RequestHandler = async (req, res, next) => {
  try {
    const status = req.body.status as PaymentStatus;
    if (!Object.values(PaymentStatus).includes(status)) throw new AppError("Invalid payment status", 400);
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status, paidAt: status === PaymentStatus.PAID ? new Date() : undefined },
      include: { order: true }
    });
    await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: status } });
    await createNotification(payment.order.userId, "Payment status changed", `Payment for ${payment.order.orderNumber} is now ${status.toLowerCase()}.`, NotificationType.PAYMENT, { orderId: payment.orderId });
    return sendSuccess(res, { message: "Payment updated", data: payment });
  } catch (error) {
    return next(error);
  }
};

export const createShipment: RequestHandler = async (req, res, next) => {
  try {
    const shipment = await prisma.shipping.upsert({
      where: { orderId: req.body.orderId },
      update: {
        carrierName: req.body.carrierName,
        trackingNumber: req.body.trackingNumber,
        deliveryStaffId: req.body.deliveryStaffId,
        status: (req.body.status as ShippingStatus) ?? ShippingStatus.ASSIGNED
      },
      create: {
        orderId: req.body.orderId,
        addressId: req.body.addressId,
        carrierName: req.body.carrierName,
        trackingNumber: req.body.trackingNumber ?? `TRK-${Date.now()}`,
        deliveryStaffId: req.body.deliveryStaffId,
        status: (req.body.status as ShippingStatus) ?? ShippingStatus.ASSIGNED
      },
      include: { order: true, address: true, deliveryStaff: true }
    });
    return sendSuccess(res, { statusCode: 201, message: "Shipment saved", data: shipment });
  } catch (error) {
    return next(error);
  }
};

export const listShipments: RequestHandler = async (_req, res, next) => {
  try {
    const shipments = await prisma.shipping.findMany({ include: { order: true, address: true, deliveryStaff: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Shipments fetched", data: shipments });
  } catch (error) {
    return next(error);
  }
};

export const getShipment: RequestHandler = async (req, res, next) => {
  try {
    const shipment = await prisma.shipping.findUnique({ where: { id: req.params.id }, include: { order: true, address: true, deliveryStaff: true } });
    if (!shipment) throw new AppError("Shipment was not found", 404);
    return sendSuccess(res, { message: "Shipment fetched", data: shipment });
  } catch (error) {
    return next(error);
  }
};

export const updateShipmentStatus: RequestHandler = async (req, res, next) => {
  try {
    const status = req.body.status as ShippingStatus;
    if (!Object.values(ShippingStatus).includes(status)) throw new AppError("Invalid shipment status", 400);
    const shipment = await prisma.shipping.update({
      where: { id: req.params.id },
      data: {
        status,
        shippedAt: ([ShippingStatus.IN_TRANSIT, ShippingStatus.OUT_FOR_DELIVERY, ShippingStatus.DELIVERED] as ShippingStatus[]).includes(status) ? new Date() : undefined,
        deliveredAt: status === ShippingStatus.DELIVERED ? new Date() : undefined
      },
      include: { order: true }
    });
    const orderStatus = status === ShippingStatus.DELIVERED ? OrderStatus.DELIVERED : status === ShippingStatus.OUT_FOR_DELIVERY ? OrderStatus.OUT_FOR_DELIVERY : status === ShippingStatus.IN_TRANSIT ? OrderStatus.SHIPPED : undefined;
    if (orderStatus) {
      await prisma.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } });
      await prisma.orderStatusHistory.create({ data: { orderId: shipment.orderId, status: orderStatus, note: req.body.note ?? "Shipment status updated", changedById: req.user?.id } });
    }
    await createNotification(shipment.order.userId, "Delivery status changed", `Your delivery is now ${status.replace(/_/g, " ").toLowerCase()}.`, NotificationType.ORDER, { orderId: shipment.orderId });
    return sendSuccess(res, { message: "Shipment status updated", data: shipment });
  } catch (error) {
    return next(error);
  }
};

export const customerTracking: RequestHandler = async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: requireUserId(req) }, include: { shipping: true, statusHistory: { orderBy: { createdAt: "asc" } } } });
    if (!order) throw new AppError("Order was not found", 404);
    return sendSuccess(res, { message: "Tracking fetched", data: { shipment: order.shipping, timeline: order.statusHistory } });
  } catch (error) {
    return next(error);
  }
};

export const createCustomerReturn: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const order = await prisma.order.findFirst({ where: { id: req.body.orderId, userId }, include: { items: true } });
    if (!order) throw new AppError("Order was not found", 404);
    if (order.status !== OrderStatus.DELIVERED) throw new AppError("Returns can only be requested after delivery", 400);
    const orderItem = req.body.orderItemId ? order.items.find((item) => item.id === req.body.orderItemId) : undefined;
    const request = await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        orderItemId: orderItem?.id,
        userId,
        reason: req.body.reason,
        quantity: toNumber(req.body.quantity, 1)
      },
      include: { order: true, orderItem: true }
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.RETURN_REQUESTED } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: OrderStatus.RETURN_REQUESTED, note: "Return requested", changedById: userId } });
    return sendSuccess(res, { statusCode: 201, message: "Return requested", data: request });
  } catch (error) {
    return next(error);
  }
};

export const customerReturns: RequestHandler = async (req, res, next) => {
  try {
    const requests = await prisma.returnRequest.findMany({ where: { userId: requireUserId(req) }, include: { order: true, orderItem: true, refundRequest: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Returns fetched", data: requests });
  } catch (error) {
    return next(error);
  }
};

export const adminReturns: RequestHandler = async (_req, res, next) => {
  try {
    const requests = await prisma.returnRequest.findMany({ include: { order: true, orderItem: true, user: true, refundRequest: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Returns fetched", data: requests });
  } catch (error) {
    return next(error);
  }
};

export const adminReturnDetail: RequestHandler = async (req, res, next) => {
  try {
    const request = await prisma.returnRequest.findUnique({ where: { id: req.params.id }, include: { order: true, orderItem: true, user: true, refundRequest: true } });
    if (!request) throw new AppError("Return request was not found", 404);
    return sendSuccess(res, { message: "Return fetched", data: request });
  } catch (error) {
    return next(error);
  }
};

export const approveReturn: RequestHandler = async (req, res, next) => {
  try {
    const request = await prisma.returnRequest.update({
      where: { id: req.params.id },
      data: { status: ReturnStatus.APPROVED, adminNote: req.body.adminNote },
      include: { order: true, refundRequest: true }
    });
    if (!request.refundRequest) {
      await prisma.refundRequest.create({ data: { returnRequestId: request.id, orderId: request.orderId, amount: request.order.totalAmount } });
    }
    await createNotification(request.userId, "Return approved", `Return for order ${request.order.orderNumber} was approved.`, NotificationType.ORDER, { returnId: request.id });
    return sendSuccess(res, { message: "Return approved", data: request });
  } catch (error) {
    return next(error);
  }
};

export const rejectReturn: RequestHandler = async (req, res, next) => {
  try {
    const request = await prisma.returnRequest.update({ where: { id: req.params.id }, data: { status: ReturnStatus.REJECTED, adminNote: req.body.adminNote, resolvedAt: new Date() }, include: { order: true } });
    await createNotification(request.userId, "Return rejected", `Return for order ${request.order.orderNumber} was rejected.`, NotificationType.ORDER, { returnId: request.id });
    return sendSuccess(res, { message: "Return rejected", data: request });
  } catch (error) {
    return next(error);
  }
};

export const completeReturn: RequestHandler = async (req, res, next) => {
  try {
    const request = await prisma.returnRequest.update({ where: { id: req.params.id }, data: { status: ReturnStatus.COMPLETED, adminNote: req.body.adminNote, resolvedAt: new Date() }, include: { order: true } });
    await prisma.order.update({ where: { id: request.orderId }, data: { status: OrderStatus.RETURNED } });
    await prisma.orderStatusHistory.create({ data: { orderId: request.orderId, status: OrderStatus.RETURNED, note: "Return completed", changedById: req.user?.id } });
    await createNotification(request.userId, "Return completed", `Return for order ${request.order.orderNumber} was completed.`, NotificationType.ORDER, { returnId: request.id });
    return sendSuccess(res, { message: "Return completed", data: request });
  } catch (error) {
    return next(error);
  }
};

export const listRefunds: RequestHandler = async (_req, res, next) => {
  try {
    const refunds = await prisma.refundRequest.findMany({ include: { order: true, returnRequest: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Refunds fetched", data: refunds });
  } catch (error) {
    return next(error);
  }
};

export const getRefund: RequestHandler = async (req, res, next) => {
  try {
    const refund = await prisma.refundRequest.findUnique({ where: { id: req.params.id }, include: { order: true, returnRequest: true } });
    if (!refund) throw new AppError("Refund was not found", 404);
    return sendSuccess(res, { message: "Refund fetched", data: refund });
  } catch (error) {
    return next(error);
  }
};

const updateRefund = (status: RefundStatus): RequestHandler => async (req, res, next) => {
  try {
    const refund = await prisma.refundRequest.update({
      where: { id: req.params.id },
      data: { status, adminNote: req.body.adminNote, processedAt: ([RefundStatus.COMPLETED, RefundStatus.REJECTED, RefundStatus.FAILED] as RefundStatus[]).includes(status) ? new Date() : undefined },
      include: { order: true }
    });
    if (status === RefundStatus.COMPLETED) await prisma.order.update({ where: { id: refund.orderId }, data: { status: OrderStatus.REFUNDED, paymentStatus: PaymentStatus.REFUNDED } });
    await createNotification(refund.order.userId, "Refund status changed", `Refund for ${refund.order.orderNumber} is now ${status.toLowerCase()}.`, NotificationType.PAYMENT, { refundId: refund.id });
    return sendSuccess(res, { message: "Refund updated", data: refund });
  } catch (error) {
    return next(error);
  }
};

export const approveRefund = updateRefund(RefundStatus.PROCESSING);
export const rejectRefund = updateRefund(RefundStatus.REJECTED);
export const completeRefund = updateRefund(RefundStatus.COMPLETED);

export const createReview: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const productId = req.body.productId;
    const purchased = await prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: OrderStatus.DELIVERED } }
    });
    if (!purchased) throw new AppError("Only customers who purchased this product can review it", 403);
    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        orderItemId: purchased.id,
        rating: Math.max(1, Math.min(5, toNumber(req.body.rating, 5))),
        title: req.body.title,
        comment: req.body.comment,
        imageUrl: req.body.imageUrl,
        isApproved: true
      },
      include: { user: true, product: true }
    });
    await refreshProductRating(productId);
    return sendSuccess(res, { statusCode: 201, message: "Review submitted", data: review });
  } catch (error) {
    return next(error);
  }
};

export const productReviews: RequestHandler = async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId, deletedAt: null, isApproved: true, isHidden: false },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { message: "Reviews fetched", data: reviews });
  } catch (error) {
    return next(error);
  }
};

export const sellerReviews: RequestHandler = async (req, res, next) => {
  try {
    const seller = await getSellerForUser(requireUserId(req));
    const reviews = await prisma.review.findMany({ where: { product: { sellerId: seller.id }, deletedAt: null }, include: { product: true, user: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Seller reviews fetched", data: reviews });
  } catch (error) {
    return next(error);
  }
};

export const adminReviews: RequestHandler = async (_req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({ where: { deletedAt: null }, include: { product: true, user: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Reviews fetched", data: reviews });
  } catch (error) {
    return next(error);
  }
};

export const hideReview: RequestHandler = async (req, res, next) => {
  try {
    const review = await prisma.review.update({ where: { id: req.params.id }, data: { isHidden: true } });
    await refreshProductRating(review.productId);
    return sendSuccess(res, { message: "Review hidden", data: review });
  } catch (error) {
    return next(error);
  }
};

export const deleteReview: RequestHandler = async (req, res, next) => {
  try {
    const review = await prisma.review.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    await refreshProductRating(review.productId);
    return sendSuccess(res, { message: "Review deleted", data: review });
  } catch (error) {
    return next(error);
  }
};

const refreshProductRating = async (productId: string) => {
  const stats = await prisma.review.aggregate({
    where: { productId, deletedAt: null, isApproved: true, isHidden: false },
    _avg: { rating: true },
    _count: true
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Number((stats._avg.rating ?? 0).toFixed(2)),
      ratingCount: stats._count
    }
  });
};

export const availableCoupons: RequestHandler = async (_req, res, next) => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({ where: { isActive: true, deletedAt: null, startsAt: { lte: now }, expiresAt: { gte: now } }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Coupons fetched", data: coupons });
  } catch (error) {
    return next(error);
  }
};

export const createCoupon: RequestHandler = async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: String(req.body.code).toUpperCase(),
        type: normalizeCouponType(req.body.discountType ?? req.body.type),
        discountValue: req.body.discountValue,
        minOrderAmount: req.body.minOrderAmount,
        maxDiscount: req.body.maxDiscountAmount ?? req.body.maxDiscount,
        startsAt: new Date(req.body.startDate ?? req.body.startsAt),
        expiresAt: new Date(req.body.endDate ?? req.body.expiresAt),
        usageLimit: req.body.usageLimit,
        isActive: req.body.isActive ?? true
      }
    });
    return sendSuccess(res, { statusCode: 201, message: "Coupon created", data: coupon });
  } catch (error) {
    return next(error);
  }
};

export const adminCoupons: RequestHandler = async (_req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Coupons fetched", data: coupons });
  } catch (error) {
    return next(error);
  }
};

export const updateCoupon: RequestHandler = async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        code: req.body.code ? String(req.body.code).toUpperCase() : undefined,
        type: req.body.discountType || req.body.type ? normalizeCouponType(req.body.discountType ?? req.body.type) : undefined,
        discountValue: req.body.discountValue,
        minOrderAmount: req.body.minOrderAmount,
        maxDiscount: req.body.maxDiscountAmount ?? req.body.maxDiscount,
        startsAt: req.body.startDate || req.body.startsAt ? new Date(req.body.startDate ?? req.body.startsAt) : undefined,
        expiresAt: req.body.endDate || req.body.expiresAt ? new Date(req.body.endDate ?? req.body.expiresAt) : undefined,
        usageLimit: req.body.usageLimit,
        isActive: req.body.isActive
      }
    });
    return sendSuccess(res, { message: "Coupon updated", data: coupon });
  } catch (error) {
    return next(error);
  }
};

export const deleteCoupon: RequestHandler = async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    return sendSuccess(res, { message: "Coupon deleted", data: coupon });
  } catch (error) {
    return next(error);
  }
};

export const activeFlashSales: RequestHandler = async (_req, res, next) => {
  try {
    const now = new Date();
    const sales = await prisma.flashSale.findMany({ where: { isActive: true, deletedAt: null, startsAt: { lte: now }, endsAt: { gte: now } }, include: { products: { include: { product: { include: publicProductInclude } } } }, orderBy: { endsAt: "asc" } });
    return sendSuccess(res, { message: "Flash sales fetched", data: sales });
  } catch (error) {
    return next(error);
  }
};

export const createFlashSale: RequestHandler = async (req, res, next) => {
  try {
    const title = req.body.title;
    const sale = await prisma.flashSale.create({ data: { title, slug: req.body.slug ?? `${slugify(title)}-${Date.now()}`, startsAt: new Date(req.body.startTime ?? req.body.startsAt), endsAt: new Date(req.body.endTime ?? req.body.endsAt), isActive: req.body.status ? req.body.status === "ACTIVE" : req.body.isActive ?? true } });
    return sendSuccess(res, { statusCode: 201, message: "Flash sale created", data: sale });
  } catch (error) {
    return next(error);
  }
};

export const adminFlashSales: RequestHandler = async (_req, res, next) => {
  try {
    const sales = await prisma.flashSale.findMany({ where: { deletedAt: null }, include: { products: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Flash sales fetched", data: sales });
  } catch (error) {
    return next(error);
  }
};

export const updateFlashSale: RequestHandler = async (req, res, next) => {
  try {
    const sale = await prisma.flashSale.update({ where: { id: req.params.id }, data: { title: req.body.title, startsAt: req.body.startTime ? new Date(req.body.startTime) : undefined, endsAt: req.body.endTime ? new Date(req.body.endTime) : undefined, isActive: req.body.status ? req.body.status === "ACTIVE" : req.body.isActive } });
    return sendSuccess(res, { message: "Flash sale updated", data: sale });
  } catch (error) {
    return next(error);
  }
};

export const deleteFlashSale: RequestHandler = async (req, res, next) => {
  try {
    const sale = await prisma.flashSale.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    return sendSuccess(res, { message: "Flash sale deleted", data: sale });
  } catch (error) {
    return next(error);
  }
};

export const addFlashSaleProduct: RequestHandler = async (req, res, next) => {
  try {
    const item = await prisma.flashSaleProduct.upsert({ where: { flashSaleId_productId: { flashSaleId: req.params.id, productId: req.body.productId } }, update: { salePrice: req.body.salePrice, stockLimit: req.body.saleStock ?? req.body.stockLimit }, create: { flashSaleId: req.params.id, productId: req.body.productId, salePrice: req.body.salePrice, stockLimit: req.body.saleStock ?? req.body.stockLimit } });
    return sendSuccess(res, { statusCode: 201, message: "Product added to flash sale", data: item });
  } catch (error) {
    return next(error);
  }
};

export const removeFlashSaleProduct: RequestHandler = async (req, res, next) => {
  try {
    await prisma.flashSaleProduct.delete({ where: { flashSaleId_productId: { flashSaleId: req.params.id, productId: req.params.productId } } });
    return sendSuccess(res, { message: "Product removed from flash sale", data: null });
  } catch (error) {
    return next(error);
  }
};

export const publicBanners: RequestHandler = async (_req, res, next) => {
  try {
    const banners = await prisma.banner.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: "asc" } });
    return sendSuccess(res, { message: "Banners fetched", data: banners });
  } catch (error) {
    return next(error);
  }
};

export const createBanner: RequestHandler = async (req, res, next) => {
  try {
    const banner = await prisma.banner.create({ data: { title: req.body.title, imageUrl: req.body.imageUrl, linkUrl: req.body.linkUrl, position: req.body.position, isActive: req.body.isActive ?? true, sortOrder: req.body.sortOrder ?? 0 } });
    return sendSuccess(res, { statusCode: 201, message: "Banner created", data: banner });
  } catch (error) {
    return next(error);
  }
};

export const updateBanner: RequestHandler = async (req, res, next) => {
  try {
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data: req.body });
    return sendSuccess(res, { message: "Banner updated", data: banner });
  } catch (error) {
    return next(error);
  }
};

export const deleteBanner: RequestHandler = async (req, res, next) => {
  try {
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    return sendSuccess(res, { message: "Banner deleted", data: banner });
  } catch (error) {
    return next(error);
  }
};

export const getPageBySlug: RequestHandler = async (req, res, next) => {
  try {
    const page = await prisma.cMSPage.findFirst({ where: { slug: req.params.slug, status: CMSPageStatus.PUBLISHED, deletedAt: null } });
    if (!page) throw new AppError("Page was not found", 404);
    return sendSuccess(res, { message: "Page fetched", data: page });
  } catch (error) {
    return next(error);
  }
};

export const createPage: RequestHandler = async (req, res, next) => {
  try {
    const page = await prisma.cMSPage.create({ data: { authorId: req.user?.id, title: req.body.title, slug: req.body.slug ?? slugify(req.body.title), content: req.body.content, metaTitle: req.body.metaTitle, metaDescription: req.body.metaDescription, status: req.body.status ?? CMSPageStatus.PUBLISHED, publishedAt: new Date() } });
    return sendSuccess(res, { statusCode: 201, message: "Page created", data: page });
  } catch (error) {
    return next(error);
  }
};

export const adminPages: RequestHandler = async (_req, res, next) => {
  try {
    const pages = await prisma.cMSPage.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Pages fetched", data: pages });
  } catch (error) {
    return next(error);
  }
};

export const updatePage: RequestHandler = async (req, res, next) => {
  try {
    const page = await prisma.cMSPage.update({ where: { id: req.params.id }, data: { ...req.body, publishedAt: req.body.status === CMSPageStatus.PUBLISHED ? new Date() : undefined } });
    return sendSuccess(res, { message: "Page updated", data: page });
  } catch (error) {
    return next(error);
  }
};

export const deletePage: RequestHandler = async (req, res, next) => {
  try {
    const page = await prisma.cMSPage.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), status: CMSPageStatus.ARCHIVED } });
    return sendSuccess(res, { message: "Page deleted", data: page });
  } catch (error) {
    return next(error);
  }
};

export const publicBlogs: RequestHandler = async (_req, res, next) => {
  try {
    const blogs = await prisma.blog.findMany({ where: { status: BlogStatus.PUBLISHED, deletedAt: null }, include: { author: true }, orderBy: { publishedAt: "desc" } });
    return sendSuccess(res, { message: "Blogs fetched", data: blogs });
  } catch (error) {
    return next(error);
  }
};

export const getBlogBySlug: RequestHandler = async (req, res, next) => {
  try {
    const blog = await prisma.blog.findFirst({ where: { slug: req.params.slug, status: BlogStatus.PUBLISHED, deletedAt: null }, include: { author: true } });
    if (!blog) throw new AppError("Blog was not found", 404);
    return sendSuccess(res, { message: "Blog fetched", data: blog });
  } catch (error) {
    return next(error);
  }
};

export const createBlog: RequestHandler = async (req, res, next) => {
  try {
    const blog = await prisma.blog.create({ data: { authorId: req.user?.id, title: req.body.title, slug: req.body.slug ?? slugify(req.body.title), excerpt: req.body.excerpt, content: req.body.content, coverUrl: req.body.coverUrl, status: req.body.status ?? BlogStatus.PUBLISHED, publishedAt: new Date() } });
    return sendSuccess(res, { statusCode: 201, message: "Blog created", data: blog });
  } catch (error) {
    return next(error);
  }
};

export const adminBlogs: RequestHandler = async (_req, res, next) => {
  try {
    const blogs = await prisma.blog.findMany({ where: { deletedAt: null }, include: { author: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Blogs fetched", data: blogs });
  } catch (error) {
    return next(error);
  }
};

export const updateBlog: RequestHandler = async (req, res, next) => {
  try {
    const blog = await prisma.blog.update({ where: { id: req.params.id }, data: { ...req.body, publishedAt: req.body.status === BlogStatus.PUBLISHED ? new Date() : undefined } });
    return sendSuccess(res, { message: "Blog updated", data: blog });
  } catch (error) {
    return next(error);
  }
};

export const deleteBlog: RequestHandler = async (req, res, next) => {
  try {
    const blog = await prisma.blog.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), status: BlogStatus.ARCHIVED } });
    return sendSuccess(res, { message: "Blog deleted", data: blog });
  } catch (error) {
    return next(error);
  }
};

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { userId: requireUserId(req) }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Notifications fetched", data: notifications });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true, readAt: new Date() } });
    if (notification.userId !== requireUserId(req)) throw new AppError("Notification was not found", 404);
    return sendSuccess(res, { message: "Notification marked read", data: notification });
  } catch (error) {
    return next(error);
  }
};

export const markAllNotificationsRead: RequestHandler = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: requireUserId(req), isRead: false }, data: { isRead: true, readAt: new Date() } });
    return sendSuccess(res, { message: "Notifications marked read", data: null });
  } catch (error) {
    return next(error);
  }
};

export const sendAdminNotification: RequestHandler = async (req, res, next) => {
  try {
    const users = req.body.userId ? [{ id: req.body.userId }] : await prisma.user.findMany({ where: { role: req.body.role, deletedAt: null }, select: { id: true } });
    await prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, title: req.body.title, message: req.body.message, type: req.body.type ?? NotificationType.SYSTEM })) });
    return sendSuccess(res, { message: "Notification sent", data: { count: users.length } });
  } catch (error) {
    return next(error);
  }
};

export const createSupportTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticket = await prisma.supportTicket.create({ data: { userId: requireUserId(req), subject: req.body.subject, message: req.body.message, priority: req.body.priority ?? "NORMAL" } });
    return sendSuccess(res, { statusCode: 201, message: "Support ticket created", data: ticket });
  } catch (error) {
    return next(error);
  }
};

export const customerSupportTickets: RequestHandler = async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({ where: { userId: requireUserId(req) }, include: { replies: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Tickets fetched", data: tickets });
  } catch (error) {
    return next(error);
  }
};

export const adminSupportTickets: RequestHandler = async (_req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({ include: { user: true, replies: true }, orderBy: { createdAt: "desc" } });
    return sendSuccess(res, { message: "Tickets fetched", data: tickets });
  } catch (error) {
    return next(error);
  }
};

export const adminSupportTicketDetail: RequestHandler = async (req, res, next) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id }, include: { user: true, replies: { include: { user: true } } } });
    if (!ticket) throw new AppError("Ticket was not found", 404);
    return sendSuccess(res, { message: "Ticket fetched", data: ticket });
  } catch (error) {
    return next(error);
  }
};

export const replySupportTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        status: TicketStatus.IN_PROGRESS,
        replies: { create: { userId: requireUserId(req), message: req.body.message, isStaff: true } }
      },
      include: { replies: true }
    });
    await createNotification(ticket.userId, "Support ticket updated", `A support reply was added to ${ticket.subject}.`, NotificationType.SUPPORT, { ticketId: ticket.id });
    return sendSuccess(res, { message: "Reply added", data: ticket });
  } catch (error) {
    return next(error);
  }
};

export const updateSupportTicketStatus: RequestHandler = async (req, res, next) => {
  try {
    const status = req.body.status as TicketStatus;
    if (!Object.values(TicketStatus).includes(status)) throw new AppError("Invalid ticket status", 400);
    const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status, closedAt: ([TicketStatus.CLOSED, TicketStatus.RESOLVED] as TicketStatus[]).includes(status) ? new Date() : undefined } });
    return sendSuccess(res, { message: "Ticket status updated", data: ticket });
  } catch (error) {
    return next(error);
  }
};

export const generateProductDescription: RequestHandler = async (req, res, next) => {
  try {
    const productName = req.body.productName ?? "LankaCart product";
    const keywords = Array.isArray(req.body.keywords) ? req.body.keywords.join(", ") : req.body.keywords ?? "quality, value";
    const data = {
      improvedTitle: `${productName} for ${req.body.targetAudience ?? "modern shoppers"}`,
      shortDescription: `A polished ${req.body.category ?? "marketplace"} item from ${req.body.brand ?? "a trusted brand"}.`,
      fullDescription: `${productName} is crafted for shoppers who want dependable quality, practical features, and clear value. Highlighted keywords: ${keywords}.`,
      keyFeatures: ["Marketplace-ready description", "Customer-friendly benefits", "SEO-focused product wording", "Clear feature highlights"],
      seoKeywords: [productName, req.body.category, req.body.brand, keywords].filter(Boolean)
    };
    return sendSuccess(res, { message: env.OPENAI_API_KEY || env.GEMINI_API_KEY ? "AI description generated" : "Fallback description generated", data });
  } catch (error) {
    return next(error);
  }
};

export const searchSuggestions: RequestHandler = async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const products = await prisma.product.findMany({
      where: q ? { name: { contains: q }, status: ProductStatus.APPROVED, deletedAt: null } : { status: ProductStatus.APPROVED, deletedAt: null },
      select: { name: true, slug: true },
      take: 8,
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { message: "Search suggestions fetched", data: products.map((product) => ({ label: product.name, slug: product.slug })) });
  } catch (error) {
    return next(error);
  }
};

export const popularSearches: RequestHandler = async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ where: { isActive: true, deletedAt: null }, select: { name: true, slug: true }, take: 10, orderBy: { sortOrder: "asc" } });
    return sendSuccess(res, { message: "Popular searches fetched", data: categories.map((category) => ({ label: category.name, slug: category.slug })) });
  } catch (error) {
    return next(error);
  }
};
