import asyncHandler from "../Lib/asynchHandler";
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../Lib/error.handler";
import prisma from "../Lib/prisma";
import { ApiResponse } from "../Lib/apiResponse";
import { json } from "stream/consumers";

export const createQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, createdById, startTime,categoryId, endTime } = req.body;

      if (!title || !createdById || !accessType || !startTime || !endTime || !categoryId) {
        throw new CustomError("All fields are required", 400);
      }

      const iscategoryId=await prisma.category.findUnique({
        where:{
            id:categoryId
        }
      })
      if(!iscategoryId){
        throw new CustomError("Category not found",404)
      }

      const newQuiz = await prisma.quiz.create({
        data: {
          title,
          createdById,
          categoryId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
      });

      return res.status(200)json(new ApiResponse(200,newQuiz,"New Quiz Created"))
    } catch (error) {
      next(error);
    }
  }
);

export const addQuestionsToQuiz = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { quizId, questions } = req.body;

      if (!quizId || !questions || !Array.isArray(questions)) {
        throw new CustomError("quizId and questions are required", 400);
      }

      const quizExists = await prisma.quiz.findUnique({
        where: { id: quizId },
      });

      if (!quizExists) {
        throw new CustomError("Quiz not found", 404);
      }

      for (const question of questions) {
        const createdQuestion = await prisma.question.create({
          data: {
            text: question.text,
            quizId: quizId,
            options: {
              create: question.options.map((opt: any) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
              })),
            },
          },
        });
      }

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Questions added successfully"));
    } catch (error) {
      next(error);
    }
  }
);


// this controller is used to get all the quiz and show on front where use select which quiz he need to attempt
export const getAllQuizController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const AllQuiz=await prisma.quiz.findMany({
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                },
            }
        })
    } catch (error) {
        next(error);
    }
})

export const getQuizByIdController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new CustomError("Quiz ID is required", 400);
        }

       const quiz = await prisma.quiz.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          questions: {
            include: {
              options: true
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

      return res.status(200).json(new ApiResponse(200, quiz, "Quiz fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const getQuizByCategoryController=asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { categoryId } = req.params;
        
        if (!categoryId) {
            throw new CustomError("Category ID is required", 400);
        }

        const isCategory = await prisma.category.findUnique({
            where: {
                id: categoryId
            }
        });
        if (!isCategory) {
            throw new CustomError("Category not found", 404);
        }

        const quizess=await prisma.quiz.findMany({
            where:{
                categoryId: categoryId
            },
            include:{
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                },
            }
        })

        if (!quizess || quizess.length === 0) {
            throw new CustomError("No quizzes found for this category", 404);
        }

        return res.status(200).json(new ApiResponse(200, quizess, "Quizzes fetched successfully"));

    } catch (error) {
        next(error)
    }
  })