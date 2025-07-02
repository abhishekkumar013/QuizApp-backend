import asyncHandler from "../Lib/asynchHandler";
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../Lib/error.handler";
// import prisma from "../Lib/prisma";
import { prisma } from "../index";
import { ApiResponse } from "../Lib/apiResponse";
import { json } from "stream/consumers";
import { equal } from "assert";

interface QuestionInput {
  text: string;
  score: number;
  explanation?: string;
  marks?: number;
  order: number;
  isRequired?: boolean;
  options: QuestionOption[];
}

interface AddQuestionsRequest {
  quizId: string;
  questions: QuestionInput[];
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name: string;
  };
  body: AddQuestionsRequest;
}

interface SubmitAnswerInput {
  questionId: string;
  selectedOptionId?: string;
  textAnswer?: string;
}

interface SubmitQuizRequest {
  quizId: string;
  sessionId: string;
  timeTaken: number;
  answers: SubmitAnswerInput[];
}

interface AuthenticatedRequestforsubmit extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name: string;
  };
  body: SubmitQuizRequest;
}

interface ManualGradingInput {
  answerId: string;
  marksAwarded: number;
  feedback?: string;
  isCorrect?: boolean;
}

interface BulkManualGradingRequest {
  resultId: string;
  gradings: ManualGradingInput[];
}

interface SingleManualGradingRequest {
  answerId: string;
  marksAwarded: number;
  feedback?: string;
  isCorrect?: boolean;
}

interface AuthenticatedRequestformanualeval extends Request {
  user?: {
    id: string;
    role: string;
    emai: string;
    name: string;
  };
}

export const createQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        title,
        description,
        instructions,
        createdById,
        startTime,
        endTime,
        categoryId,
        accessType,
        status,
        difficulty,
        durationInMinutes,
        totalMarks,
        passingMarks,
        maxAttempts,
      } = req.body;

      if (
        !title ||
        !createdById ||
        !accessType ||
        !startTime ||
        !endTime ||
        !categoryId ||
        !durationInMinutes ||
        !maxAttempts ||
        !difficulty
      ) {
        throw new CustomError("All fields are required", 400);
      }

      const isCategoryId = await prisma.category.findUnique({
        where: {
          id: categoryId,
        },
      });

      if (!isCategoryId) {
        throw new CustomError("Category not found", 404);
      }

      const newQuiz = await prisma.quiz.create({
        data: {
          title,
          description,
          instructions,
          createdById,
          categoryId,
          accessType,
          status,
          difficulty,
          durationInMinutes,
          totalMarks,
          passingMarks,
          maxAttempts,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
      });

      return res
        .status(200)
        .json(new ApiResponse(200, newQuiz, "New Quiz Created"));
    } catch (error) {
      next(error);
    }
  }
);

export const addQuestionsToQuiz = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { quizId, questions } = req.body;

      const userId = req.user?.id;
      if (!userId) {
        throw new CustomError("User not authenticated", 401);
      }

      // Validate required fields
      if (!quizId || !questions || !Array.isArray(questions)) {
        throw new CustomError("quizId and questions array are required", 400);
      }

      if (questions.length === 0) {
        throw new CustomError("At least one question is required", 400);
      }

      // Validate each question
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        if (!question.text || question.text.trim() === "") {
          throw new CustomError(`Question ${i + 1}: text is required`, 400);
        }

        if (typeof question.score !== "number" || question.score < 0) {
          throw new CustomError(
            `Question ${i + 1}: score must be a non-negative number`,
            400
          );
        }

        if (typeof question.order !== "number" || question.order < 0) {
          throw new CustomError(
            `Question ${i + 1}: order must be a non-negative number`,
            400
          );
        }

        if (
          !question.options ||
          !Array.isArray(question.options) ||
          question.options.length === 0
        ) {
          throw new CustomError(
            `Question ${
              i + 1
            }: options array is required and must not be empty`,
            400
          );
        }

        // Validate options
        let hasCorrectAnswer = false;
        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j];

          if (!option.text || option.text.trim() === "") {
            throw new CustomError(
              `Question ${i + 1}, Option ${j + 1}: text is required`,
              400
            );
          }

          if (typeof option.isCorrect !== "boolean") {
            throw new CustomError(
              `Question ${i + 1}, Option ${j + 1}: isCorrect must be a boolean`,
              400
            );
          }

          if (option.isCorrect) {
            hasCorrectAnswer = true;
          }
        }

        if (!hasCorrectAnswer) {
          throw new CustomError(
            `Question ${i + 1}: at least one option must be marked as correct`,
            400
          );
        }
      }

      // Check if user is authorized to modify this quiz
      const isUserCreateQuiz = await prisma.quiz.findFirst({
        where: {
          id: quizId,
          createdById: userId,
        },
      });

      if (!isUserCreateQuiz) {
        throw new CustomError(
          "You are not authorized to add questions to this quiz",
          403
        );
      }

      // Get the current highest order number for existing questions
      const lastQuestion = await prisma.question.findFirst({
        where: { quizId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      let currentMaxOrder = lastQuestion?.order || 0;

      // Create questions with their options in a transaction
      const createdQuestions = await prisma.$transaction(async (tx) => {
        const questionPromises = questions.map(async (question, index) => {
          // Auto-increment order if not provided or if there's a conflict
          const questionOrder = question.order || currentMaxOrder + index + 1;

          return await tx.question.create({
            data: {
              text: question.text.trim(),
              score: question.score,
              explanation: question.explanation?.trim() || null,
              marks: question.marks || 1,
              order: questionOrder,
              isRequired:
                question.isRequired !== undefined ? question.isRequired : true,
              quizId: quizId,
              options: {
                create: question.options.map((opt, optIndex) => ({
                  text: opt.text.trim(),
                  isCorrect: opt.isCorrect,
                  order: opt.order || optIndex + 1,
                })),
              },
            },
            include: {
              options: true,
            },
          });
        });

        return await Promise.all(questionPromises);
      });

      // Update quiz total marks
      const totalMarksToAdd = questions.reduce(
        (sum, q) => sum + (q.marks || 1),
        0
      );
      await prisma.quiz.update({
        where: { id: quizId },
        data: {
          totalMarks: {
            increment: totalMarksToAdd,
          },
        },
      });
      await prisma.quiz.update({
        where: {
          id: quizId,
        },
        data: {
          status: "PUBLISHED",
        },
      });

      return res.status(201).json(
        new ApiResponse(
          201,
          {
            questionsAdded: createdQuestions.length,
            questions: createdQuestions,
            totalMarksAdded: totalMarksToAdd,
          },
          "Questions added successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// this controller is used to get all the quiz and show on front where user select which quiz he need to attempt
export const getAllQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new CustomError("Unauthorized", 401);
      }

      const role = req.user?.role;
      if (role !== "STUDENT") {
        throw new CustomError("Login With Student Id To See Al Quiz", 403);
      }

      // Find the studentProfileId from userId
      const studentProfile = await prisma.studentProfile.findFirst({
        where: { userId },
        select: { id: true },
      });

      if (!studentProfile) {
        throw new CustomError("Student profile not found", 404);
      }

      const studentProfileId = studentProfile.id;

      // Fetch all public quizzes
      const publicQuizzes = await prisma.quiz.findMany({
        where: {
          accessType: "PUBLIC",
          status: "PUBLISHED",
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          title: true,
          description: true,
          instructions: true,
          status: true,
          durationInMinutes: true,
          difficulty: true,
          totalMarks: true,
          maxAttempts: true,
          startTime: true,
          endTime: true,
          category: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Fetch assigned quizzes to the student
      const assignedQuizzes = await prisma.quizAssignment.findMany({
        where: {
          studentId: studentProfileId,
        },
        orderBy: {
          assignedAt: "asc",
        },
        select: {
          quiz: {
            select: {
              id: true,
              title: true,
              description: true,
              instructions: true,
              status: true,
              durationInMinutes: true,
              difficulty: true,
              totalMarks: true,
              maxAttempts: true,
              startTime: true,
              endTime: true,
              category: {
                select: { id: true, name: true },
              },
              createdBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      const assignedQuizList = assignedQuizzes.map((q) => q.quiz);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            publicQuizzes,
            assignedQuizzes: assignedQuizList,
          },
          "Quizzes fetched successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const getAllOwnQuizFor_TeacherController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new CustomError("Unauthorized", 401);
      }

      const role = req.user?.role;
      if (role !== "TEACHER") {
        throw new CustomError(
          "Login With Teacher Id To See All Your Quiz",
          403
        );
      }

      const quizSelectFields = {
        id: true,
        title: true,
        description: true,
        instructions: true,
        status: true,
        durationInMinutes: true,
        difficulty: true,
        totalMarks: true,
        maxAttempts: true,
        startTime: true,
        endTime: true,
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      };

      const [publicQuizzes, privateQuizzes, protectedQuizzes] =
        await Promise.all([
          prisma.quiz.findMany({
            where: { accessType: "PUBLIC", createdById: userId },
            orderBy: { createdAt: "asc" },
            select: quizSelectFields,
          }),
          prisma.quiz.findMany({
            where: { accessType: "PRIVATE", createdById: userId },
            orderBy: { createdAt: "asc" },
            select: quizSelectFields,
          }),
          prisma.quiz.findMany({
            where: { accessType: "PROTECTED", createdById: userId },
            orderBy: { createdAt: "asc" },
            select: quizSelectFields,
          }),
        ]);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            publicQuizzes,
            privateQuizzes,
            protectedQuizzes,
          },
          "Teacher's quizzes fetched successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const getQuizByIdController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new CustomError("Quiz ID is required", 400);
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          instructions: true,
          totalMarks: true,
          accessType: true,
          maxAttempts: true,
          durationInMinutes: true,
          startTime: true,
          endTime: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          questions: {
            include: {
              options: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!quiz) {
        throw new CustomError("Quiz not found", 404);
      }

      const isAssigned = await prisma.quizAssignment.findFirst({
        where: {
          quizId: id,
          studentId: req.user?.roleId, // Assuming user ID is stored in req.user
        },
      });

      if (!isAssigned && quiz.accessType !== "PUBLIC") {
        throw new CustomError("You are not authorized to view this quiz", 403);
      }

      return res
        .status(200)
        .json(new ApiResponse(200, quiz, "Quiz fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const getQuizByCategoryController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;

      if (!categoryId) {
        throw new CustomError("Category ID is required", 400);
      }

      const isCategory = await prisma.category.findUnique({
        where: {
          id: categoryId,
        },
      });
      if (!isCategory) {
        throw new CustomError("Category not found", 404);
      }

      const quizess = await prisma.quiz.findMany({
        where: {
          categoryId: categoryId,
          accessType: "PUBLIC",
          status: "PUBLISHED",
          endTime: { lte: new Date() },
        },
        select: {
          id: true,
          title: true,
          durationInMinutes: true,
          description: true,
          instructions: true,
          difficulty: true,
          totalMarks: true,
          maxAttempts: true,
          startTime: true,
          endTime: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const assignedQuiz = await prisma.quizAssignment.findMany({
        where: {
          studentId: req.user?.id,
        },
        select: {
          quiz: {
            select: {
              id: true,
              title: true,
              description: true,
              instructions: true,
              durationInMinutes: true,
              totalMarks: true,
              maxAttempts: true,
              difficulty: true,
              startTime: true,
              endTime: true,
              category: {
                select: { id: true, name: true },
              },
              createdBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      if (!quizess || quizess.length === 0) {
        throw new CustomError("No quizzes found for this category", 404);
      }

      return res
        .status(200)
        .json(new ApiResponse(200, quizess, "Quizzes fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const deleteQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!id) {
        throw new CustomError("Quiz ID is required", 400);
      }

      const userId = req.user?.id;

      const isUserCreateQuiz = await prisma.quiz.findFirst({
        where: {
          createdBy: userId,
        },
      });
      if (!isUserCreateQuiz) {
        throw new CustomError(
          "You are not authorized to delete this quiz",
          403
        );
      }

      const allquestions = await prisma.question.findMany({
        where: {
          quizId: id,
        },
      });

      const questionid = allquestions.map((q) => q.id);

      await prisma.option.deleteMany({
        where: {
          questionId: {
            in: questionid,
          },
        },
      });

      await prisma.question.deleteMany({
        where: {
          quizId: id,
        },
      });
      await prisma.quiz.delete({
        where: {
          id: id,
        },
      });

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Quiz deleted successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const startQuizController = asyncHandler(async (req, res, next) => {
  const { quizId } = req.body;
  const id = req.user?.id;
  const profile = await prisma.studentProfile.findFirst({
    where: {
      userId: id,
    },
  });

  // quiz session
  const session = await prisma.quizSession.create({
    data: {
      quizId,
      studentId,
      studentProfileId: profile?.id,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  return res.json(
    new ApiResponse(200, { sessionId: session.id }, "Quiz started")
  );
});

export const submitQuizController = asyncHandler(
  async (
    req: AuthenticatedRequestforsubmit,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { quizId, sessionId, timeTaken, answers } = req.body;
      const studentId = req.user?.id;

      if (!studentId) {
        throw new CustomError("User not authenticated", 401);
      }

      // Validate required fields
      if (
        !quizId ||
        !sessionId ||
        timeTaken === undefined ||
        !Array.isArray(answers)
      ) {
        throw new CustomError(
          "Quiz ID, session ID, time taken, and answers are required",
          400
        );
      }

      if (timeTaken < 0) {
        throw new CustomError("Time taken must be a positive number", 400);
      }

      // Verify the quiz session belongs to this student and is in progress
      const quizSession = await prisma.quizSession.findFirst({
        where: {
          id: sessionId,
          quizId: quizId,
          studentId: studentId,
          status: "IN_PROGRESS",
        },
        include: {
          studentProfile: true,
        },
      });

      if (!quizSession) {
        throw new CustomError(
          "Invalid quiz session or session already completed",
          400
        );
      }

      // Fetch quiz with questions and options
      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          questions: {
            include: {
              options: true,
            },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!quiz) {
        throw new CustomError("Quiz not found", 404);
      }

      // Check if quiz is still active (if time limits are set)
      const now = new Date();
      if (quiz.endTime && now > quiz.endTime) {
        throw new CustomError("Quiz submission time has expired", 400);
      }

      // Validate answers
      const questionIds = quiz.questions.map((q) => q.id);
      for (const answer of answers) {
        if (!questionIds.includes(answer.questionId)) {
          throw new CustomError(
            `Invalid question ID: ${answer.questionId}`,
            400
          );
        }

        // For multiple choice, ensure option exists and belongs to the question
        if (answer.selectedOptionId) {
          const question = quiz.questions.find(
            (q) => q.id === answer.questionId
          );
          const optionExists = question?.options.some(
            (opt) => opt.id === answer.selectedOptionId
          );
          if (!optionExists) {
            throw new CustomError(
              `Invalid option ID: ${answer.selectedOptionId} for question: ${answer.questionId}`,
              400
            );
          }
        }
      }

      // Process submission in a transaction
      const result = await prisma.$transaction(async (tx) => {
        let totalMarks = 0;
        let score = 0;
        let questionsCorrect = 0;
        let questionsIncorrect = 0;
        let questionsAttempted = 0;
        let questionsSkipped = 0;

        const evaluation = [];
        const answerRecords = [];

        // Process each question
        for (const question of quiz.questions) {
          totalMarks += question.marks;
          const userAnswer = answers.find((a) => a.questionId === question.id);

          if (
            !userAnswer ||
            (!userAnswer.selectedOptionId && !userAnswer.textAnswer)
          ) {
            // Question was skipped
            questionsSkipped++;

            // Still create an answer record for skipped questions
            const answerRecord = await tx.answer.create({
              data: {
                sessionId: sessionId,
                questionId: question.id,
                optionId: null,
                textAnswer: null,
                isCorrect: false,
                marksAwarded: 0,
              },
            });
            answerRecords.push(answerRecord);

            evaluation.push({
              questionId: question.id,
              questionText: question.text,
              selectedOptionId: null,
              selectedOptionText: null,
              textAnswer: null,
              correctOptionId:
                question.options.find((opt) => opt.isCorrect)?.id || null,
              correctOptionText:
                question.options.find((opt) => opt.isCorrect)?.text || null,
              isCorrect: false,
              marksAwarded: 0,
              skipped: true,
            });
            continue;
          }

          questionsAttempted++;

          // Handle multiple choice questions
          if (userAnswer.selectedOptionId) {
            const selectedOption = question.options.find(
              (o) => o.id === userAnswer.selectedOptionId
            );
            const correctOption = question.options.find((opt) => opt.isCorrect);
            const isCorrect = selectedOption?.isCorrect || false;
            const marksAwarded = isCorrect ? question.marks : 0;

            if (isCorrect) {
              score += marksAwarded;
              questionsCorrect++;
            } else {
              questionsIncorrect++;
            }

            // Create answer record
            const answerRecord = await tx.answer.create({
              data: {
                sessionId: sessionId,
                questionId: question.id,
                optionId: userAnswer.selectedOptionId,
                textAnswer: null,
                isCorrect: isCorrect,
                marksAwarded: marksAwarded,
              },
            });
            answerRecords.push(answerRecord);

            evaluation.push({
              questionId: question.id,
              questionText: question.text,
              selectedOptionId: userAnswer.selectedOptionId,
              selectedOptionText: selectedOption?.text || null,
              textAnswer: null,
              correctOptionId: correctOption?.id || null,
              correctOptionText: correctOption?.text || null,
              isCorrect: isCorrect,
              marksAwarded: marksAwarded,
              skipped: false,
            });
          }
          // Handle text/essay questions
          else if (userAnswer.textAnswer) {
            // For text questions, manual grading is needed
            const answerRecord = await tx.answer.create({
              data: {
                sessionId: sessionId,
                questionId: question.id,
                optionId: null,
                textAnswer: userAnswer.textAnswer.trim(),
                isCorrect: null,
                marksAwarded: 0,
              },
            });
            answerRecords.push(answerRecord);

            evaluation.push({
              questionId: question.id,
              questionText: question.text,
              selectedOptionId: null,
              selectedOptionText: null,
              textAnswer: userAnswer.textAnswer.trim(),
              correctOptionId: null,
              correctOptionText: null,
              isCorrect: null, // Pending manual grading
              marksAwarded: 0, // Pending manual grading
              skipped: false,
              needsManualGrading: true,
            });
          }
        }

        // Update quiz session
        const updatedSession = await tx.quizSession.update({
          where: { id: sessionId },
          data: {
            status: "COMPLETED",
            submittedAt: new Date(),
            timeSpent: timeTaken,
          },
        });

        // Calculate percentage
        const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
        const isPassed = score >= quiz.passingMarks;

        // Get attempt number
        const previousAttempts = await tx.result.count({
          where: {
            quizId: quizId,
            studentId: studentId,
          },
        });

        // Create result record
        const quizResult = await tx.result.create({
          data: {
            studentId: studentId,
            quizId: quizId,
            sessionId: sessionId,
            score: score,
            totalMarks: totalMarks,
            percentage: percentage,
            questionsAttempted: questionsAttempted,
            questionsCorrect: questionsCorrect,
            questionsIncorrect: questionsIncorrect,
            questionsSkipped: questionsSkipped,
            timeTaken: timeTaken,
            isPassed: isPassed,
            attemptNumber: previousAttempts + 1,
            submittedAt: new Date(),
          },
        });

        return {
          result: quizResult,
          evaluation: evaluation,
          session: updatedSession,
        };
      });

      // Return success response
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            score: result.result.score,
            totalMarks: result.result.totalMarks,
            percentage: result.result.percentage,
            questionsAttempted: result.result.questionsAttempted,
            questionsCorrect: result.result.questionsCorrect,
            questionsIncorrect: result.result.questionsIncorrect,
            questionsSkipped: result.result.questionsSkipped,
            timeTaken: result.result.timeTaken,
            isPassed: result.result.isPassed,
            attemptNumber: result.result.attemptNumber,
            evaluation: quiz.showResults ? result.evaluation : null, // Only show if quiz allows it
            submittedAt: result.result.submittedAt,
          },
          "Quiz submitted successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const getPendingEvaluationsController = asyncHandler(
  async (
    req: AuthenticatedRequestformanualeval,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const teacherId = req.user?.id;
      const role = req.user?.role;
      const { quizId, studentId, page = 1, limit = 10 } = req.query;

      if (!teacherId) {
        throw new CustomError("User not authenticated", 401);
      }
      if (role !== "TEACHER") {
        throw new CustomError("UnAuthorized Access", 403);
      }

      const skip = (Number(page) - 1) * Number(limit);

      const whereClause: any = {
        quiz: {
          createdById: teacherId,
        },
        answers: {
          some: {
            isCorrect: null,
          },
        },
      };

      if (quizId) {
        whereClause.quizId = quizId as string;
      }

      if (studentId) {
        whereClause.studentId = studentId as string;
      }

      const [submissions, totalCount] = await Promise.all([
        prisma.result.findMany({
          where: whereClause,
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            quiz: {
              select: {
                id: true,
                title: true,
                totalMarks: true,
              },
            },
            // Get the session to access answers
            sessions: {
              where: {
                id: {
                  equals: prisma.result.fields.sessionId,
                },
              },
              include: {
                answers: {
                  where: {
                    isCorrect: null,
                  },
                  include: {
                    question: {
                      select: {
                        id: true,
                        text: true,
                        marks: true,
                        explanation: true,
                      },
                    },
                  },
                  orderBy: {
                    question: {
                      order: "asc",
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            submittedAt: "desc",
          },
          skip,
          take: Number(limit),
        }),
        prisma.result.count({ where: whereClause }),
      ]);

      const pendingSubmissions = submissions.filter((submission) =>
        submission.sessions?.some((session) =>
          session.answers.some((answer) => answer.isCorrect === null)
        )
      );

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            submissions: pendingSubmissions,
            pagination: {
              currentPage: Number(page),
              totalPages: Math.ceil(totalCount / Number(limit)),
              totalCount,
              hasNext: skip + Number(limit) < totalCount,
              hasPrev: Number(page) > 1,
            },
          },
          "Pending evaluations retrieved successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// grade

export const gradeAnswerController = asyncHandler(
  async (
    req: AuthenticatedRequestformanualevalequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const teacherId = req.user?.id;

      const {
        answerId,
        marksAwarded,
        feedback,
        isCorrect,
      }: SingleManualGradingRequest = req.body;

      if (!teacherId) {
        throw new CustomError("User not authenticated", 401);
      }
      if (req.user?.role !== "TEACEHER") {
        throw new CustomError("Only teacher can grade ansers", 403);
      }

      if (!answerId || marksAwarded === undefined) {
        throw new CustomError("Try Again!", 400);
      }
      if (marksAwarded < 0) {
        throw new CustomError("Marks awared cannot be negative", 400);
      }

      const answer = await prisma.answer.findFirst({
        where: {
          id: answerId,
          session: {
            quiz: {
              categoryId: teacherId,
            },
          },
        },
        include: {
          question: true,
          session: {
            include: {
              quiz: true,
            },
          },
        },
      });

      if (!answer) {
        throw new CustomError("Answer not found or unauthorized", 404);
      }

      if (marksAwarded > answer.question.marks) {
        throw new CustomError(
          `Marks awarded (${marksAwarded}) cannot exceed question maximum (${answer.question.marks})`,
          400
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedAnswer = await tx.answer.update({
          where: {
            id: answerId,
          },
          data: {
            marksAwarded: marksAwarded,
            isCorrect: isCorrect !== undefined ? isCorrect : marksAwarded > 0,
          },
        });
        const allAnswers = await tx.answer.findMany({
          where: {
            sessionId: answer.sessionId,
          },
        });
        const newScore = allAnswers.reduce(
          (sum, ans) => sum + (ans.marksAwarded || 0),
          0
        );
        const newCorrectCount = allAnswers.filter(
          (ans) => ans.isCorrect === true
        ).length;
        const newIncorrectCount = allAnswers.filter(
          (ans) => ans.isCorrect === false
        ).length;
        const totalMarks = answer.session.quiz.totalMarks;
        const newPercentage =
          totalMarks > 0 ? (newScore / totalMarks) * 100 : 0;
        const isPassed = newScore >= answer.session.quiz.passingMarks;

        // Update the result
        const updatedResult = await tx.result.update({
          where: {
            sessionId: answer.sessionId,
          },
          data: {
            score: newScore,
            percentage: newPercentage,
            questionsCorrect: newCorrectCount,
            questionsIncorrect: newIncorrectCount,
            isPassed: isPassed,
          },
        });

        return { updatedAnswer, updatedResult };
      });

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            answer: result.updatedAnswer,
            updatedResult: {
              score: result.updatedResult.score,
              percentage: result.updatedResult.percentage,
              isPassed: result.updatedResult.isPassed,
            },
          },
          "Answer graded successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// bulk grading

export const bulkGradeANswerController = asyncHandler(
  async (
    req: AuthenticatedRequestformanualeval,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const teacherId = req.user?.id;

      const { resultId, gradings }: BulkManualGradingRequest = req.body;

      if (!teacherId) {
        throw new CustomError("User not authenticated", 401);
      }
      if (req.user?.role !== "TEACEHER") {
        throw new CustomError("Only teacher can grade ansers", 403);
      }
      if (
        !resultId ||
        !gradings ||
        !Array.isArray(gradings) ||
        gradings.length === 0
      ) {
        throw new CustomError("Result ID and gradings array are required", 400);
      }

      for (let i = 0; i < gradings.length; i++) {
        const grading = gradings[i];
        if (!grading.answerId || grading.marksAwarded === undefined) {
          throw new CustomError(
            `Grading ${i + 1}: Answer ID and marks awarded are required`,
            400
          );
        }
        if (grading.marksAwarded < 0) {
          throw new CustomError(
            `Grading ${i + 1}: Marks awarded cannot be negative`,
            400
          );
        }
      }
      const result = await prisma.result.findFirst({
        where: {
          id: resultId,
          quiz: {
            createdById: teacherId,
          },
        },
        include: {
          quiz: true,
        },
      });

      if (!result) {
        throw new CustomError("Result not found or unauthorized", 404);
      }

      const updateResult = await prisma.$transaction(async (tx) => {
        const updatedAnswers = [];
        for (const grading of gradings) {
          const answer = await tx.answer.findFirst({
            where: {
              id: grading.answerId,
              sessionId: result.sessionId!,
            },
            include: {
              question: true,
            },
          });
          if (!answer) {
            throw new CustomError(`Answer ${grading.answerId} not found`, 404);
          }

          if (grading.marksAwarded > answer.question.marks) {
            throw new CustomError(
              `Answer ${grading.answerId}: Marks awarded (${grading.marksAwarded}) cannot exceed question maximum (${answer.question.marks})`,
              400
            );
          }

          const updatedAnswer = await tx.answer.update({
            where: {
              id: grading.answerId,
            },
            data: {
              marksAwarded: grading.marksAwarded,
              isCorrect:
                grading.isCorrect !== undefined
                  ? grading.isCorrect
                  : grading.marksAwarded > 0,
            },
          });
          updatedAnswers.push(updatedAnswer);
        }
        const allAnswers = await tx.answer.findMany({
          where: {
            sessionId: result.sessionId!,
          },
        });

        const newScore = allAnswers.reduce(
          (sum, ans) => sum + (ans.marksAwarded || 0),
          0
        );
        const newCorrectCount = allAnswers.filter(
          (ans) => ans.isCorrect === true
        ).length;
        const newIncorrectCount = allAnswers.filter(
          (ans) => ans.isCorrect === false
        ).length;
        const totalMarks = result.quiz.totalMarks;
        const newPercentage =
          totalMarks > 0 ? (newScore / totalMarks) * 100 : 0;
        const isPassed = newScore >= result.quiz.passingMarks;

        // Update the result
        const finalResult = await tx.result.update({
          where: { id: resultId },
          data: {
            score: newScore,
            percentage: newPercentage,
            questionsCorrect: newCorrectCount,
            questionsIncorrect: newIncorrectCount,
            isPassed: isPassed,
          },
        });

        return { updatedAnswers, finalResult };
      });

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            gradedAnswers: updatedResult.updatedAnswers.length,
            updatedResult: {
              score: updatedResult.finalResult.score,
              percentage: updatedResult.finalResult.percentage,
              isPassed: updatedResult.finalResult.isPassed,
            },
          },
          `Successfully graded ${updatedResult.updatedAnswers.length} answers`
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const gradingStatsController = asyncHandler(
  async (
    req: AuthenticatedRequestformanualeval,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const teacherId = req.user?.id;

      if (!teacherId) {
        throw new CustomError("User not authenticated", 401);
      }
      if (req.user?.role !== "TEACHER") {
        throw new CustomError(
          "Only teachers can access grading statistics",
          403
        );
      }
      const stats = await prisma.result.findMany({
        where: {
          quiz: {
            createdById: teacherId,
          },
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
          sessions: {
            include: {
              answers: {
                select: {
                  isCorrect: true,
                },
              },
            },
          },
        },
      });

      let totalSubmissions = stats.length;
      let pendingGrading = 0;
      let fullyGraded = 0;
      let partiallyGraded = 0;

      const quizStats: { [key: string]: any } = {};

      for (const result of stats) {
        const session = result.sessions?.[0];
        if (!session) continue;

        const answers = session.answers;
        const pendingAnswers = answers.filter(
          (a) => a.isCorrect === null
        ).length;
        const totalAnswers = answers.length;

        if (pendingAnswers === 0) {
          fullyGraded++;
        } else if (pendingAnswers === totalAnswers) {
          pendingGrading++;
        } else {
          partiallyGraded++;
        }

        // Quiz-specific stats
        const quizId = result.quiz.id;
        if (!quizStats[quizId]) {
          quizStats[quizId] = {
            quizTitle: result.quiz.title,
            totalSubmissions: 0,
            pendingGrading: 0,
            fullyGraded: 0,
            partiallyGraded: 0,
          };
        }

        quizStats[quizId].totalSubmissions++;
        if (pendingAnswers === 0) {
          quizStats[quizId].fullyGraded++;
        } else if (pendingAnswers === totalAnswers) {
          quizStats[quizId].pendingGrading++;
        } else {
          quizStats[quizId].partiallyGraded++;
        }
      }

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            overallStats: {
              totalSubmissions,
              pendingGrading,
              fullyGraded,
              partiallyGraded,
              gradingProgress:
                totalSubmissions > 0
                  ? (fullyGraded / totalSubmissions) * 100
                  : 0,
            },
            quizStats: Object.values(quizStats),
          },
          "Grading statistics retrieved successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const getQuizReportController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { quizId } = req.query;
      const studentId = req.user?.roleId;

      if (!quizId || !studentId) {
        throw new CustomError("quizId and studentId are required", 400);
      }

      const result = await prisma.result.findFirst({
        where: {
          quizId: quizId as string,
          studentId: studentId as string,
        },
        orderBy: { submittedAt: "desc" },
        include: {
          quiz: {
            include: {
              questions: {
                include: { options: true },
                orderBy: { order: "asc" },
              },
            },
          },
          student: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          session: {
            include: {
              answers: {
                include: {
                  option: true,
                  question: {
                    include: { options: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!result || !result.session) {
        throw new CustomError("Quiz result not found", 404);
      }

      const answerMap = new Map();
      result.session.answers.forEach((ans) => {
        answerMap.set(ans.questionId, ans);
      });

      const report = result.quiz.questions.map((question) => {
        const answer = answerMap.get(question.id);
        const correctOption = question.options.find((opt) => opt.isCorrect);

        if (!answer) {
          // Skipped question
          return {
            questionId: question.id,
            questionText: question.text,
            selectedOptionId: null,
            selectedOptionText: null,
            textAnswer: null,
            correctOptionId: correctOption?.id || null,
            correctOptionText: correctOption?.text || null,
            isCorrect: false,
            skipped: true,
            marksAwarded: 0,
            explanation: question.explanation || null,
          };
        }

        return {
          questionId: question.id,
          questionText: question.text,
          selectedOptionId: answer.option?.id || null,
          selectedOptionText: answer.option?.text || null,
          textAnswer: answer.textAnswer || null,
          correctOptionId: correctOption?.id || null,
          correctOptionText: correctOption?.text || null,
          isCorrect: answer.isCorrect,
          skipped: false,
          marksAwarded: answer.marksAwarded,
          explanation: question.explanation || null,
        };
      });

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            student: result.student,
            quiz: {
              id: result.quiz.id,
              title: result.quiz.title,
              totalMarks: result.totalMarks,
              score: result.score,
              percentage: result.percentage,
              timeTaken: result.timeTaken,
              questionsAttempted: result.questionsAttempted,
              questionsCorrect: result.questionsCorrect,
              questionsIncorrect: result.questionsIncorrect,
              questionsSkipped: result.questionsSkipped,
              isPassed: result.isPassed,
              submittedAt: result.submittedAt,
            },
            report,
          },
          "Quiz report generated successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const getAllAttempetedQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req?.user.id;

      const attemptedQuizzes = await prisma.result.findMany({
        where: {
          studentId: userId,
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              description: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!attemptedQuizzes || attemptedQuizzes.length === 0) {
        throw CustomError("No attempted quizzes found for this user", 400);
      }
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            attemptedQuizzes,
            "Attempted quizzes fetched successfully"
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

//  for admin or teacher
export const getStudentsWhoAttemptedQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quizId = req.params.id;

      const userId = req?.user.id;

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          role: true,
        },
      });
      if (user?.role !== "ADMIN" && user?.role !== "TEACHER") {
        throw CustomError("You are not authorized to view this data", 403);
      }

      const isQUiz = await prisma.quiz.findUnique({
        where: {
          id: quizId,
        },
      });
      if (!isQUiz) {
        throw CustomError("Quiz not found", 404);
      }

      const studentList = await prisma.result.findMany({
        where: {
          quizId: quizId,
        },
        select: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          // quiz:{
          //     select: {
          //         id: true,
          //         title: true,
          //         createdBy:{
          //             select:{
          //                 id: true,
          //                 name: true,
          //                 email: true,
          //             }
          //         }
          //     }
          // },
          score: true,
          createdAt: true,
        },
      });
      if (!studentList || studentList.length === 0) {
        throw CustomError("No students have attempted this quiz", 404);
      }
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            studentList,
            "Students who attempted the quiz fetched successfully"
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

export const getAllPublicQUizzesController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quizes = await prisma.quiz.findMany({
        where: {
          accessType: "PUBLIC",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      if (!quizes || quizes.length === 0) {
        throw new CustomError("No public quizzes found", 404);
      }
      return res
        .status(200)
        .json(
          new ApiResponse(200, quizes, "Public quizzes fetched successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);
