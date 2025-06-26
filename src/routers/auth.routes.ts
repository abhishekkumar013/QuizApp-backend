import {
  addChildToParentController,
  getAllParentsController,
  getAllStudentController,
  getAllTeachersController,
  getExactSearchForTeacherController,
  getExactSearchForUserController,
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

router.route("/parents/:id/add-child").put(addChildToParentController);

router.route("/search/student").get(getExactSearchForUserController);
router.route("/search/teacher").get(getExactSearchForTeacherController);

// Student routes
router.route("/students/:id/parent").put(updateStudentParentController);

router.use(isAdmin);
// Parent routes
router.route("/parents").get(getAllParentsController);
router.route("/parents/search/:search").get(searchParentController);

// Teacher routes
router.route("/teachers").get(getAllTeachersController);
router.route("/teachers/search/:search").get(searchTeacherController);

// Admin routes

router.route("/admin/users").get(GetUserController);
router.route("/students").get(getAllStudentController);
router.route("/students/search/:search").get(searchStudentController);

export default router;
