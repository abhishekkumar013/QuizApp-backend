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
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
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

      const rankfinder=await prisma.result.findMany({
        where:{
          quizId: id
        },
        orderBy:{
          score:"desc"
        },
        select:{
          studentId:true,
          score:true
        }
      })

      const studentrank=rankfinder.findIndex((s)=>s.studentId===studentId)+1;

      res
        .status(200)
        .json(new ApiResponse(200, {...result ,  rank:studentrank}, "Result retrieved successfully"));
    } catch (error) {
      next(error);
    }
  }
);


// rank for a particular quiz
export const getAllStudentRankController = asyncHandler(
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
        include: {
          student: {
            select: {
              name: true,
              email: true,
              id: true,
            },
          },
        },
        orderBy: {
          score: "desc",
        },
      });
      if (!results || results.length === 0) {
        throw new CustomError("No results found for this quiz", 404);
      }

      const rankedResults = results.map((result, index) => ({
        rank: index + 1,
        studentId: result.studentId,
        studentName: result.student.name,
        studentEmail: result.student.email,
        score: result.score,
        percentage: result.percentage,
        totalMarks: result.totalMarks,
        questionsAttempted: result.questionsAttempted,
        questionsCorrect: result.questionsCorrect,
        questionsIncorrect: result.questionsIncorrect,
        questionsSkipped: result.questionsSkipped,
        timeTaken: result.timeTaken,
        isPassed: result.isPassed,
        attemptNumber: result.attemptNumber,
        submittedAt: result.submittedAt,
      }));

      return res
        .status(200)
        .json(
          new ApiResponse(200, results:rankedResults, "Quiz ranks retrieved successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);
