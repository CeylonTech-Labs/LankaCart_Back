import { RequestHandler } from "express";
import { addWishlistItem, getWishlist, removeWishlistItem } from "../services/wishlist.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

const userId = (req: Parameters<RequestHandler>[0]) => {
  if (!req.user?.id) throw new AppError("Authentication is required", 401);
  return req.user.id;
};

export const getMyWishlist: RequestHandler = async (req, res, next) => {
  try {
    const wishlist = await getWishlist(userId(req));
    return sendSuccess(res, { message: "Wishlist fetched successfully", data: wishlist });
  } catch (error) {
    return next(error);
  }
};

export const addToWishlist: RequestHandler = async (req, res, next) => {
  try {
    const item = await addWishlistItem(userId(req), req.params.productId);
    return sendSuccess(res, { statusCode: 201, message: "Product added to wishlist", data: item });
  } catch (error) {
    return next(error);
  }
};

export const removeFromWishlist: RequestHandler = async (req, res, next) => {
  try {
    await removeWishlistItem(userId(req), req.params.productId);
    return sendSuccess(res, { message: "Product removed from wishlist" });
  } catch (error) {
    return next(error);
  }
};
