import express, { Router } from "express";
import { isAuthenticated } from "../middlwares/Auth.middleware";
import { isAdmin } from "../middlwares/isAdmin.middleware";
import { isTeacher } from "../middlwares/isTeacher.middleware";
import {
  getAllResultController,
  getAllStudentRankController,
  getResultByIdController,
} from "../controllers/Result.controller";

const router: Router = express.Router();

router.use(isAuthenticated);

router.route("/rank").get(getAllStudentRankController);
router.route("/").get(getAllResultController);
router.route("/:id").get(getResultByIdController);

export default router;
