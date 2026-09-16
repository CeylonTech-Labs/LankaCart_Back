import { RequestHandler } from "express";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress
} from "../services/address.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

const userIdFromRequest = (req: Parameters<RequestHandler>[0]) => {
  if (!req.user?.id) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const getAddresses: RequestHandler = async (req, res, next) => {
  try {
    const addresses = await listCustomerAddresses(userIdFromRequest(req));
    return sendSuccess(res, { message: "Addresses fetched successfully", data: addresses });
  } catch (error) {
    return next(error);
  }
};

export const createAddress: RequestHandler = async (req, res, next) => {
  try {
    const address = await createCustomerAddress(userIdFromRequest(req), req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Address created successfully",
      data: address
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAddress: RequestHandler = async (req, res, next) => {
  try {
    const address = await updateCustomerAddress(userIdFromRequest(req), req.params.id, req.body);
    return sendSuccess(res, { message: "Address updated successfully", data: address });
  } catch (error) {
    return next(error);
  }
};

export const removeAddress: RequestHandler = async (req, res, next) => {
  try {
    await deleteCustomerAddress(userIdFromRequest(req), req.params.id);
    return sendSuccess(res, { message: "Address deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const setDefaultAddress: RequestHandler = async (req, res, next) => {
  try {
    const address = await setDefaultCustomerAddress(userIdFromRequest(req), req.params.id);
    return sendSuccess(res, { message: "Default address updated successfully", data: address });
  } catch (error) {
    return next(error);
  }
};
