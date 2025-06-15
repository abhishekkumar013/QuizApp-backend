import {
  addChildToParentController,
  getAllParentsController,
  getAllStudentController,
  getAllTeachersController,
  GetUserController,
  resetPasswordController,
  searchParentController,
  searchStudentController,
  searchTeacherController,
  SearchUsersController,
  SignInController,
  SignOutController,
  SignUpController,
  updateStudentParentController,
  updateUserController,
} from "../controllers/Auth.controller";
import express, { Router } from "express";
import { isAuthenticated } from "../middlwares/Auth.middleware";
import { isAdmin } from "../middlwares/isAdmin.middleware";

const router: Router = express.Router();

router.route("/users/signup").post(SignUpController);
router.route("/users/signin").post(SignInController);

router.use(isAuthenticated);

router.route("/users/signout").post(SignOutController);
router.route("/users/search/:search").get(SearchUsersController);
router.route("/users/:id").put(updateUserController);
router.route("/users/reset-password").put(resetPasswordController);

// Student routes
router.route("/students").get(getAllStudentController);
router.route("/students/search/:search").get(searchStudentController);
router.route("/students/:id/parent").put(updateStudentParentController);

// Parent routes
router.route("/parents").get(getAllParentsController);
router.route("/parents/search/:search").get(searchParentController);
router.route("/parents/:id/add-child").put(addChildToParentController);

// Teacher routes
router.route("/teachers").get(getAllTeachersController);
router.route("/teachers/search/:search").get(searchTeacherController);

// Admin routes
router.use(isAdmin);
router.route("/admin/users").get(GetUserController);

export default router;
