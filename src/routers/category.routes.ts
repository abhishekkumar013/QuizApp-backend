import express, { Router } from "express";
import {
  createCategoryController,
  deleteCategoryController,
  getAllCategoryController,
  updateCategoryCotroller,
} from "../controllers/Category.controller";
import { isAuthenticated } from "../middlwares/Auth.middleware";
import { isAdmin } from "../middlwares/isAdmin.middleware";

const router: Router = express.Router();

router.route("/all").get(getAllCategoryController);
router.use(isAuthenticated);
router.use(isAdmin);

router.route("/create").post(createCategoryController);
router.route("/delete/:id").delete(deleteCategoryController);
router.route("/update/:id").put(updateCategoryCotroller);

export default router;
