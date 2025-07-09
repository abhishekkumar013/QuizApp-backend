import express, { Router } from "express";
import { isAuthenticated } from "../middlwares/Auth.middleware";
import { isAdmin } from "../middlwares/isAdmin.middleware";
import { isTeacher } from "../middlwares/isTeacher.middleware";
import {
  addQuestionsToQuiz,
  bulkGradeANswerController,
  createQuizController,
  createQuizWithQuestions,
  deleteQuizController,
  getAllAttempetedQuizController,
  getAllOwnQuizFor_TeacherController,
  getAllPublicQUizzesController,
  getAllQuizController,
  getPendingEvaluationsController,
  getQuizByCategoryController,
  getQuizByIdController,
  getQuizByIdFor_Teacher_Controller,
  getQuizReportController,
  getQuizReportForTeacher,
  getStudentsWhoAttemptedQuizController,
  gradeAnswerController,
  gradingStatsController,
  startQuizController,
  submitQuizController,
  updateQuizWithQuestions,
} from "../controllers/Quiz.controller";

const router: Router = express.Router();

router.route("/public").get(getAllPublicQUizzesController);

router.use(isAuthenticated);
// router.use(isTeacher);

router.route("/all-quiz").get(getAllQuizController);
router.route("/id/:id").get(getQuizByIdController);

router.route("/category/:categoryId").get(getQuizByCategoryController);

router.route("/delete/:id").delete(deleteQuizController);

router.route("/start/:quizId").post(startQuizController);
router.route("/submit/:quizId").post(submitQuizController);

router.route("/report").get(getQuizReportController);

router.route("/attempted").get(getAllAttempetedQuizController);

router.use(isTeacher);
router.route("/create").post(createQuizController);
router.route("/add/questions").post(addQuestionsToQuiz);
router.route("/create-quiz-question").post(createQuizWithQuestions);
router.route("/pending-evaluation").get(getPendingEvaluationsController);
router.route("/grade").post(gradeAnswerController);
router.route("/bulk-grade").post(bulkGradeANswerController);
router.route("/grade-statics").get(gradingStatsController);
router.route("/own-quiz").get(getAllOwnQuizFor_TeacherController);
router.route("/teacher/report/:quizId").get(getQuizReportForTeacher);
router.route("/teacher/:id").get(getQuizByIdFor_Teacher_Controller);
router.route("/update/:quizId").put(updateQuizWithQuestions);

router.use(isAdmin);

router
  .route("/attmpted-student/:quizId")
  .get(getStudentsWhoAttemptedQuizController);

export default router;
