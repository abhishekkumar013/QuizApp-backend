import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import prisma from "../Lib/prisma";
import { CustomError } from "../Lib/error.handler";
import { ApiResponse } from "../Lib/apiResponse";

export const getAllResultController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        throw new CustomError("Unauthorized", 401);
      }

      const results = await prisma.result.findMany({
        where: {
          studentId: studentId,
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              durationInMinutes: true,
            },
          },
        },
      });
      if (!results || results.length === 0) {
        throw new CustomError("No results found", 404);
      }
      res
        .status(200)
        .json(new ApiResponse(200, results, "Results retrieved successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const getResultByIdController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;
      const id = req.params.id;

      if (!studentId) {
        throw new CustomError("Unauthorized", 401);
      }
      if (!id) {
        throw new CustomError("Result ID is required", 400);
      }

      const result = await prisma.result.findUnique({
        where: {
          quizId: id,
          studentId: studentId,
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              durationInMinutes: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!result) {
        throw new CustomError("Result not found", 404);
      }
      res
        .status(200)
        .json(new ApiResponse(200, result, "Result retrieved successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const quizRankController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quizId = req.params.id;
      if (!quizId) {
        throw new CustomError("Quiz ID is required", 400);
      }
      const results = await prisma.result.findMany({
        where: {
          quizId: quizId,
        },
        orderBy: {
          score: "desc",
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      if (!results || results.length === 0) {
        throw new CustomError("No results found for this quiz", 404);
      }
      return res
        .status(200)
        .json(
          new ApiResponse(200, results, "Quiz ranks retrieved successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);
