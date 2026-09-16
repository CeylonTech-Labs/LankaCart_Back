import { Router } from "express";
import { getCategories, getCategory } from "../controllers/category.controller";
import { validate } from "../middlewares/validate.middleware";
import { slugParamSchema } from "../validations/catalog.validation";

const router = Router();

router.get("/", getCategories);
router.get("/:slug", validate(slugParamSchema), getCategory);

export default router;
