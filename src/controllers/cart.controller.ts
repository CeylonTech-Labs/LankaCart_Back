import { RequestHandler } from "express";
import { addCartItem, clearCart, getCart, removeCartItem, updateCartItem } from "../services/cart.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

const userId = (req: Parameters<RequestHandler>[0]) => {
  if (!req.user?.id) throw new AppError("Authentication is required", 401);
  return req.user.id;
};

export const getMyCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await getCart(userId(req));
    return sendSuccess(res, { message: "Cart fetched successfully", data: cart });
  } catch (error) {
    return next(error);
  }
};

export const addItemToCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await addCartItem(userId(req), req.body);
    return sendSuccess(res, { statusCode: 201, message: "Item added to cart", data: cart });
  } catch (error) {
    return next(error);
  }
};

export const updateItemInCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await updateCartItem(userId(req), req.params.id, req.body.quantity);
    return sendSuccess(res, { message: "Cart item updated", data: cart });
  } catch (error) {
    return next(error);
  }
};

export const deleteItemFromCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await removeCartItem(userId(req), req.params.id);
    return sendSuccess(res, { message: "Cart item removed", data: cart });
  } catch (error) {
    return next(error);
  }
};

export const clearMyCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await clearCart(userId(req));
    return sendSuccess(res, { message: "Cart cleared", data: cart });
  } catch (error) {
    return next(error);
  }
};
