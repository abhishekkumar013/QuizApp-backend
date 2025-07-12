import express, { Router } from "express";
import {
  getAllResultController,
  getAllStudentRankController,
  getResultByIdController,
  getStudentResultForParentController,
} from "../controllers/Result.controller";
import { isAuthenticated } from "../middlwares/Auth.middleware";

const router: Router = express.Router();

router.use(isAuthenticated);

router.route("/rank").get(getAllStudentRankController);
router.route("/child/:childrenId").get(getStudentResultForParentController)
router.route("/all").get(getAllResultController);
router.route("/single/:id").get(getResultByIdController);

export default router;
