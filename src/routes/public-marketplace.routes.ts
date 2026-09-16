import { Router } from "express";
import {
  activeFlashSales,
  availableCoupons,
  getBlogBySlug,
  getPageBySlug,
  popularSearches,
  publicBanners,
  publicBlogs,
  searchSuggestions
} from "../controllers/marketplace.controller";

export const couponRoutes = Router().get("/available", availableCoupons);
export const flashSaleRoutes = Router().get("/active", activeFlashSales);
export const bannerRoutes = Router().get("/", publicBanners);
export const pageRoutes = Router().get("/:slug", getPageBySlug);
export const blogRoutes = Router().get("/", publicBlogs).get("/:slug", getBlogBySlug);
export const searchRoutes = Router().get("/suggestions", searchSuggestions).get("/popular", popularSearches);
