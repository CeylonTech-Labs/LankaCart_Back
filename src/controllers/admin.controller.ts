import { SellerStatus } from "@prisma/client";
import { RequestHandler } from "express";
import {
  getDashboardStats,
  getSellerById,
  getUserById,
  listSellers,
  listUsers,
  softDeleteUser,
  updateSellerStatus,
  updateUserStatus
} from "../services/admin.service";
import { sendSuccess } from "../utils/apiResponse";

export const getUsers: RequestHandler = async (_req, res, next) => {
  try {
    const users = await listUsers();
    return sendSuccess(res, { message: "Users fetched successfully", data: users });
  } catch (error) {
    return next(error);
  }
};

export const getUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    return sendSuccess(res, { message: "User fetched successfully", data: user });
  } catch (error) {
    return next(error);
  }
};

export const setUserStatus: RequestHandler = async (req, res, next) => {
  try {
    const user = await updateUserStatus(req.params.id, req.body.isActive);
    return sendSuccess(res, { message: "User status updated successfully", data: user });
  } catch (error) {
    return next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    await softDeleteUser(req.params.id);
    return sendSuccess(res, { message: "User deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getSellers: RequestHandler = async (_req, res, next) => {
  try {
    const sellers = await listSellers();
    return sendSuccess(res, { message: "Sellers fetched successfully", data: sellers });
  } catch (error) {
    return next(error);
  }
};

export const getPendingSellers: RequestHandler = async (_req, res, next) => {
  try {
    const sellers = await listSellers(SellerStatus.PENDING);
    return sendSuccess(res, { message: "Pending sellers fetched successfully", data: sellers });
  } catch (error) {
    return next(error);
  }
};

export const getSeller: RequestHandler = async (req, res, next) => {
  try {
    const seller = await getSellerById(req.params.id);
    return sendSuccess(res, { message: "Seller fetched successfully", data: seller });
  } catch (error) {
    return next(error);
  }
};

export const approveSeller: RequestHandler = async (req, res, next) => {
  try {
    const seller = await updateSellerStatus(req.params.id, SellerStatus.APPROVED);
    return sendSuccess(res, { message: "Seller approved successfully", data: seller });
  } catch (error) {
    return next(error);
  }
};

export const rejectSeller: RequestHandler = async (req, res, next) => {
  try {
    const seller = await updateSellerStatus(req.params.id, SellerStatus.REJECTED);
    return sendSuccess(res, { message: "Seller rejected successfully", data: seller });
  } catch (error) {
    return next(error);
  }
};

export const suspendSeller: RequestHandler = async (req, res, next) => {
  try {
    const seller = await updateSellerStatus(req.params.id, SellerStatus.SUSPENDED);
    return sendSuccess(res, { message: "Seller suspended successfully", data: seller });
  } catch (error) {
    return next(error);
  }
};

export const dashboardStats: RequestHandler = async (_req, res, next) => {
  try {
    const stats = await getDashboardStats();
    return sendSuccess(res, { message: "Dashboard stats fetched successfully", data: stats });
  } catch (error) {
    return next(error);
  }
};
