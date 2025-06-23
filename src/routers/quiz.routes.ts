import express, { Router } from "express";
import { isAuthenticated } from "../middlwares/Auth.middleware";
import { isAdmin } from "../middlwares/isAdmin.middleware";
import { isTeacher } from "../middlwares/isTeacher.middleware";
import {
  addQuestionsToQuiz,
  bulkGradeANswerController,
  createQuizController,
  deleteQuizController,
  getAllAttempetedQuizController,
  getAllQuizController,
  getPendingEvaluationsController,
  getQuizByCategoryController,
  getQuizByIdController,
  getQuizReportController,
  getStudentsWhoAttemptedQuizController,
  gradeAnswerController,
  gradingStatsController,
  startQuizController,
  submitQuizController,
} from "../controllers/Quiz.controller";

const router: Router = express.Router();

router.use(isAuthenticated);
// router.use(isTeacher);

router.route("/all-quiz").get(getAllQuizController);
router.route("/id/:id").get(getQuizByIdController);

router.route("/category/:categoryId").get(getQuizByCategoryController);

router.route("/delete/:id").delete(deleteQuizController);

router.route("/start/:quizId").post(startQuizController);

router.route("/submit").post(submitQuizController);

router
  .route("/report?quizId=QUIZ_ID&studentId=STUDENT_ID")
  .get(getQuizReportController);

router.route("/attempted").get(getAllAttempetedQuizController);

router.use(isTeacher);
router.route("/create/quiz").post(createQuizController);
router.route("/add/questions").post(addQuestionsToQuiz);
router.route("/pending-evaluation").get(getPendingEvaluationsController);
router.route("/grade").post(gradeAnswerController);
router.route("/bulk-grade").post(bulkGradeANswerController);
router.route("/grade-statics").get(gradingStatsController);

router.use(isAdmin);

router
  .route("/attmpted-student/:quizId")
  .get(getStudentsWhoAttemptedQuizController);
