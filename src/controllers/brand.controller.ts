import { RequestHandler } from "express";
import { createBrand, deleteBrand, listBrands, updateBrand } from "../services/brand.service";
import { sendSuccess } from "../utils/apiResponse";

export const getBrands: RequestHandler = async (_req, res, next) => {
  try {
    const brands = await listBrands();
    return sendSuccess(res, { message: "Brands fetched successfully", data: brands });
  } catch (error) {
    return next(error);
  }
};

export const createAdminBrand: RequestHandler = async (req, res, next) => {
  try {
    const brand = await createBrand(req.body);
    return sendSuccess(res, { statusCode: 201, message: "Brand created successfully", data: brand });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminBrand: RequestHandler = async (req, res, next) => {
  try {
    const brand = await updateBrand(req.params.id, req.body);
    return sendSuccess(res, { message: "Brand updated successfully", data: brand });
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminBrand: RequestHandler = async (req, res, next) => {
  try {
    await deleteBrand(req.params.id);
    return sendSuccess(res, { message: "Brand deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
