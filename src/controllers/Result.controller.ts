import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
// import prisma from "../Lib/prisma";
import { prisma } from "../index";
import { CustomError } from "../Lib/error.handler";
import { ApiResponse } from "../Lib/apiResponse";

export const getAllResultController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.roleId;
      if (!studentId) throw new CustomError("Unauthorized", 401);

      const results = await prisma.result.findMany({
        where: { studentId },
        orderBy: { submittedAt: "asc" },
        include: {
          student: { select: { id: true, Rank: true, points: true } },
          quiz: {
            select: {
              title: true,
              totalMarks: true,
              durationInMinutes: true,
              difficulty: true,
              passingMarks: true,
              category: { select: { name: true } },
              createdBy: {
                select: {
                  user: { select: { name: true, email: true } },
                },
              },
              
            },
          },
          
        },
      });

      if (!results || results.length === 0) {
        throw new CustomError("No results found", 404);
      }

      const studentData = results[0].student;

     
      res.status(200).json(
        new ApiResponse(200, {
          rank: studentData.Rank,
          points: studentData.points,
          results: results,
        }, "Results retrieved successfully")
      );
    } catch (error) {
      next(error);
    }
  }
);


export const getAllResultByIdController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.roleId;
      const resultId=req.params.resultId;

      if (!studentId) throw new CustomError("Unauthorized", 401);

      const result = await prisma.result.findFirst({
        where: { studentId ,id:resultId},
        include: {
          student: { select: { id: true, Rank: true, points: true } },
          quiz: {
            select: {
              title: true,
              totalMarks: true,
              durationInMinutes: true,
              difficulty: true,
              passingMarks: true,
              category: { select: { name: true } },
              createdBy: {
                select: {
                  user: { select: { name: true, email: true } },
                },
              },
              questions: {
                select: {
                  id: true,
                  text: true,
                  marks: true,
                  isRequired: true,
                  options: {
                    select: {
                      id: true,
                      text: true,
                      isCorrect: true,
                      order: true,
                    },
                  },
                },
              },
            },
          },
          session: {
            select: {
              answers: {
                select: {
                  questionId: true,
                  optionId: true,
                  isCorrect: true,
                  option: {
                    select: { text: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!result) {
        throw new CustomError("No results found", 404);
      }

      const studentData = result.student;

      

      res.status(200).json(
        new ApiResponse(200, {
          rank: studentData.Rank,
          points: studentData.points,
          results: result,
        }, "Results retrieved successfully")
      );
    } catch (error) {
      next(error);
    }
  }
);

// export const getResultByIdController = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const studentId = req.user?.id;
//       const id = req.params.id;

//       if (!studentId) {
//         throw new CustomError("Unauthorized", 401);
//       }
//       if (!id) {
//         throw new CustomError("Result ID is required", 400);
//       }

//       const result = await prisma.result.findUnique({
//         where: {
//           quizId: id,
//           studentId: studentId,
//         },
//         include: {
//           quiz: {
//             select: {
//               id: true,
//               title: true,
//               durationInMinutes: true,
//               createdBy: {
//                 select: {
//                   id: true,
//                   name: true,
//                 },
//               },
//               category: {
//                 select: {
//                   id: true,
//                   name: true,
//                 },
//               },
//             },
//           },
//         },
//       });

//       if (!result) {
//         throw new CustomError("Result not found", 404);
//       }

//       const rankfinder = await prisma.result.findMany({
//         where: {
//           quizId: id,
//         },
//         orderBy: {
//           score: "desc",
//         },
//         select: {
//           studentId: true,
//           score: true,
//         },
//       });

//       const studentrank =
//         rankfinder.findIndex((s) => s.studentId === studentId) + 1;

//       res
//         .status(200)
//         .json(
//           new ApiResponse(
//             200,
//             { ...result, rank: studentrank },
//             "Result retrieved successfully"
//           )
//         );
//     } catch (error) {
//       next(error);
//     }
//   }
// );

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
          new ApiResponse(
            200,
            { results: rankedResults },
            "Quiz ranks retrieved successfully"
          )
        );
    } catch (error) {
      next(error);
    }
  }
);
export const getStudentResultForParentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.params?.childrenId;
      // console.log(studentId)
      if (!studentId) {
        throw new CustomError("Unauthorized  ho", 401);
      }

      const results =await prisma.result.findMany({
        where:{
          studentId: studentId,
        },
        include:{
          student:{
            select:{
              id:true,

            }
          },
          quiz:{
            select:{
              title:true,
              totalMarks:true,
              durationInMinutes:true,
              difficulty:true,
              category:{
                select:{
                  name:true
                }
              },
              createdBy:{
                select:{
                  user:{
                    select:{
                        email:true,
                        name:true
                    }
                  }
                }
              },
              passingMarks:true,

            }
          }
        }
      })
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