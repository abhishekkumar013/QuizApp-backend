import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import prisma from "../Lib/prisma";
import { CustomError } from "../Lib/error.handler";
import { ApiResponse } from "../Lib/apiResponse";

export const getAllAttempetedQuiz = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req?.user.id;

       const attemptedQuizzes = await prisma.result.findMany({
        where: {
          studentId: userId,
        },
        include:{
            quiz:{
                select:{
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
                }
            }
        }
      });

      if (!attemptedQuizzes || attemptedQuizzes.length === 0) {
        throw CustomError("No attempted quizzes found for this user", 400);
      }
      return res.status(200).json(new ApiResponse(200,attemptedQuizzes"Attempted quizzes fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

//  for admin or teacher
export const getStudentsWhoAttemptedQuizController = asyncHandler(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const quizId = req.params.id;

        const userId= req?.user.id;

        const user=await prisma.user.findUnique({
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

        const isQUiz=await prisma.quiz.findUnique({
            where: {
                id: quizId,
            },
        })
        if (!isQUiz) {
            throw CustomError("Quiz not found", 404);
        }

        const studentList=await prisma.result.findMany({
            where:{
                quizId: quizId,
            },
            select:{
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
            }
        })
        if (!studentList || studentList.length === 0) {
            throw CustomError("No students have attempted this quiz", 404);
        }
        return res.status(200).json(new ApiResponse(200,studentList,"Students who attempted the quiz fetched successfully"));
    } catch (error) {
        next(error);
    }
})

