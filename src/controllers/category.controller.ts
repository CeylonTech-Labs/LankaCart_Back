import { RequestHandler } from "express";
import {
  createCategory,
  deleteCategory,
  getCategoryBySlug,
  listCategories,
  updateCategory
} from "../services/category.service";
import { sendSuccess } from "../utils/apiResponse";

export const getCategories: RequestHandler = async (_req, res, next) => {
  try {
    const categories = await listCategories();
    return sendSuccess(res, { message: "Categories fetched successfully", data: categories });
  } catch (error) {
    return next(error);
  }
};

export const getCategory: RequestHandler = async (req, res, next) => {
  try {
    const category = await getCategoryBySlug(req.params.slug);
    return sendSuccess(res, { message: "Category fetched successfully", data: category });
  } catch (error) {
    return next(error);
  }
};

export const createAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    const category = await createCategory(req.body);
    return sendSuccess(res, { statusCode: 201, message: "Category created successfully", data: category });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    const category = await updateCategory(req.params.id, req.body);
    return sendSuccess(res, { message: "Category updated successfully", data: category });
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    await deleteCategory(req.params.id);
    return sendSuccess(res, { message: "Category deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
