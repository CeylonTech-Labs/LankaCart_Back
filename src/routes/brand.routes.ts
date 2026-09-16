import { Router } from "express";
import { getBrands } from "../controllers/brand.controller";

const router = Router();

router.get("/", getBrands);

export default router;
