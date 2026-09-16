import { ProductStatus } from "@prisma/client";
import { RequestHandler } from "express";
import {
  createSellerProduct,
  deleteAdminProduct,
  deleteProductImage,
  deleteSellerProduct,
  getProductBySlug,
  getSellerProduct,
  getSellerProducts,
  listAdminProducts,
  listFeaturedProducts,
  listNewArrivals,
  listProductsByCategory,
  listPublicProducts,
  listTopSelling,
  setAdminProductFeatured,
  updateAdminProductStatus,
  updateSellerProduct,
  uploadProductImages
} from "../services/product.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

const requireUserId = (req: Parameters<RequestHandler>[0]) => {
  if (!req.user?.id) throw new AppError("Authentication is required", 401);
  return req.user.id;
};

export const getProducts: RequestHandler = async (req, res, next) => {
  try {
    const result = await listPublicProducts(req.query);
    return sendSuccess(res, { message: "Products fetched successfully", data: result.products, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const getFeaturedProducts: RequestHandler = async (_req, res, next) => {
  try {
    const products = await listFeaturedProducts();
    return sendSuccess(res, { message: "Featured products fetched successfully", data: products });
  } catch (error) {
    return next(error);
  }
};

export const getNewArrivals: RequestHandler = async (_req, res, next) => {
  try {
    const products = await listNewArrivals();
    return sendSuccess(res, { message: "New arrivals fetched successfully", data: products });
  } catch (error) {
    return next(error);
  }
};

export const getTopSellingProducts: RequestHandler = async (_req, res, next) => {
  try {
    const products = await listTopSelling();
    return sendSuccess(res, { message: "Top selling products fetched successfully", data: products });
  } catch (error) {
    return next(error);
  }
};

export const getProduct: RequestHandler = async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    return sendSuccess(res, { message: "Product fetched successfully", data: product });
  } catch (error) {
    return next(error);
  }
};

export const getProductsByCategory: RequestHandler = async (req, res, next) => {
  try {
    const result = await listProductsByCategory(req.params.categorySlug, req.query);
    return sendSuccess(res, { message: "Category products fetched successfully", data: result.products, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const searchProducts: RequestHandler = async (req, res, next) => {
  try {
    const result = await listPublicProducts({ ...req.query, q: String(req.query.q ?? "") });
    return sendSuccess(res, { message: "Search results fetched successfully", data: result.products, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const createProductForSeller: RequestHandler = async (req, res, next) => {
  try {
    const product = await createSellerProduct(requireUserId(req), req.body);
    return sendSuccess(res, { statusCode: 201, message: "Product submitted for approval", data: product });
  } catch (error) {
    return next(error);
  }
};

export const getSellerProductList: RequestHandler = async (req, res, next) => {
  try {
    const products = await getSellerProducts(requireUserId(req));
    return sendSuccess(res, { message: "Seller products fetched successfully", data: products });
  } catch (error) {
    return next(error);
  }
};

export const getSellerProductById: RequestHandler = async (req, res, next) => {
  try {
    const product = await getSellerProduct(requireUserId(req), req.params.id);
    return sendSuccess(res, { message: "Seller product fetched successfully", data: product });
  } catch (error) {
    return next(error);
  }
};

export const updateProductForSeller: RequestHandler = async (req, res, next) => {
  try {
    const product = await updateSellerProduct(requireUserId(req), req.params.id, req.body);
    return sendSuccess(res, { message: "Product updated and resubmitted", data: product });
  } catch (error) {
    return next(error);
  }
};

export const deleteProductForSeller: RequestHandler = async (req, res, next) => {
  try {
    await deleteSellerProduct(requireUserId(req), req.params.id);
    return sendSuccess(res, { message: "Product deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const uploadSellerProductImages: RequestHandler = async (req, res, next) => {
  try {
    const result = await uploadProductImages(requireUserId(req), req.params.id, req.files as Express.Multer.File[]);
    return sendSuccess(res, { message: "Images uploaded successfully", data: result });
  } catch (error) {
    return next(error);
  }
};

export const deleteSellerProductImage: RequestHandler = async (req, res, next) => {
  try {
    await deleteProductImage(requireUserId(req), req.params.imageId);
    return sendSuccess(res, { message: "Image deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getAdminProducts: RequestHandler = async (_req, res, next) => {
  try {
    const products = await listAdminProducts();
    return sendSuccess(res, { message: "Admin products fetched successfully", data: products });
  } catch (error) {
    return next(error);
  }
};

export const getPendingProducts: RequestHandler = async (_req, res, next) => {
  try {
    const products = await listAdminProducts(ProductStatus.PENDING);
    return sendSuccess(res, { message: "Pending products fetched successfully", data: products });
  } catch (error) {
    return next(error);
  }
};

export const approveProduct: RequestHandler = async (req, res, next) => {
  try {
    const product = await updateAdminProductStatus(req.params.id, ProductStatus.APPROVED);
    return sendSuccess(res, { message: "Product approved successfully", data: product });
  } catch (error) {
    return next(error);
  }
};

export const rejectProduct: RequestHandler = async (req, res, next) => {
  try {
    const product = await updateAdminProductStatus(req.params.id, ProductStatus.REJECTED);
    return sendSuccess(res, { message: "Product rejected successfully", data: product });
  } catch (error) {
    return next(error);
  }
};

export const featureProduct: RequestHandler = async (req, res, next) => {
  try {
    const product = await setAdminProductFeatured(req.params.id, Boolean(req.body.isFeatured ?? true));
    return sendSuccess(res, { message: "Product feature status updated", data: product });
  } catch (error) {
    return next(error);
  }
};

export const deleteProductAsAdmin: RequestHandler = async (req, res, next) => {
  try {
    await deleteAdminProduct(req.params.id);
    return sendSuccess(res, { message: "Product deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
