import asyncHandler from "../Lib/asynchHandler";
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../Lib/error.handler";
import prisma from "../Lib/prisma";
import { ApiResponse } from "../Lib/apiResponse";
import { json } from "stream/consumers";

export const createQuizController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, createdById, startTime,categoryId,accessType,duration, endTime } = req.body;

      if (!title || !createdById || !accessType || !startTime || !endTime || !categoryId || !duration) {
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
          accessType,
          categoryId,
          durationInMinutes:duration,
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

      const userId = req.user?.id; // Assuming user ID is stored in req.user
      if (!userId) {
        throw new CustomError("User not authenticated", 401);
      }
      const isUserCreateQuiz=await prisma.quiz.findFirst({
        where: {
          id: quizId,
          createdById: userId,
        },
      })
      if (!isUserCreateQuiz) {
        throw new CustomError("You are not authorized to add questions to this quiz", 403);
      }

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
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError("Unauthorized", 401);
    }

    // Find the studentProfileId from userId
    const studentProfile = await prisma.studentProfile.findUnique({
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
        endTime: { lte: new Date() },
      },
      select: {
        id: true,
        title: true,
        durationInMinutes: true,
        startTime: true,
        endTime: true,
        category: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
    });

    // Fetch assigned quizzes to the student
    const assignedQuizzes = await prisma.quizAssignment.findMany({
      where: {
        studentId: studentProfileId,
        quiz: {
          endTime: { lte: new Date() },
        }
      },
      select: {
        quiz: {
          select: {
            id: true,
            title: true,
            durationInMinutes: true,
            startTime: true,
            endTime: true,
            category: {
              select: { id: true, name: true }
            },
            createdBy: {
              select: { id: true, name: true, email: true }
            },
          }
        }
      }
    });

    const assignedQuizList = assignedQuizzes.map(q => q.quiz);

    return res.status(200).json(
      new ApiResponse(200, {
        publicQuizzes,
        assignedQuizzes: assignedQuizList
      }, "Quizzes fetched successfully")
    );
  } catch (error) {
    next(error);
  }
});

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


      const isAssigned=await prisma.quizAssignment.findFirst({
        where: {
          quizId: id,
          studentId: req.user?.id, // Assuming user ID is stored in req.user
        },
      })
      if(!isAssigned && quiz.accessType !== "PUBLIC") {
        throw new CustomError("You are not authorized to view this quiz", 403);
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
                categoryId: categoryId,
                accessType: "PUBLIC",
            },
            select:{
                id: true,
                title: true,
                durationInMinutes: true,
                startTime: true,
                endTime: true,
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

        const assignedQuiz=await prisma.quizAssignment.findMany({
          where:{
            studentId:req.user?.id
          },
          select:{
            quiz: {
              select: {
                id: true,
                title: true,
                durationInMinutes: true,
                startTime: true,
                endTime: true,
                category: {
                  select: { id: true, name: true }
                },
                createdBy: {
                  select: { id: true, name: true, email: true }
                },
              }
            }
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


export const deleteQuizController = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const id=req.params.id
    if (!id) {
      throw new CustomError("Quiz ID is required", 400);
    }

    const userId=req.user?.id; 

    const isUserCreateQuiz = await prisma.quiz.findFirst({
      where:{
        createdBy:userId
      }
    })
    if (!isUserCreateQuiz) {
      throw new CustomError("You are not authorized to delete this quiz", 403);
    }

    const allquestions=await prisma.question.findMany({
      where:{
        quizId:id
      }
    })

    const questionid=allquestions.map((q)=>q.id)

    await prisma.option.deleteMany({
      where:{
        questionId:{
          in: questionid
        }
      }
    })

    await prisma.question.deleteMany({
      where:{
        quizId:id
      }
    })
    await prisma.quiz.delete({
      where: {
        id: id,
      },
    })

    return res.status(200).json(new ApiResponse(200, null, "Quiz deleted successfully"));

  } catch (error) {
    next(error);
  }
})


export const submitQUizController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, timeTaken, answers } = req.body;
    const studentId = req.user.id;

    if (!quizId || !timeTaken || !Array.isArray(answers) || answers.length === 0) {
      throw new CustomError("Quiz ID, time taken, and answers are required", 400);
    } 

    // Fetch quiz with questions and options
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    let totalScore = 0;
    let score = 0;
    let questionsCorrect = 0;
    let questionsIncorrect = 0;
    let questionsAttempted = 0;

    const evaluation = [];

    for (const question of quiz.questions) {
      totalScore += question.score;
      const userAnswer = answers.find(a => a.questionId === question.id);
      const correctOption = question.options.find(opt => opt.isCorrect);

      if (!userAnswer || !correctOption) continue;

      const selectedOption = question.options.find(o => o.id === userAnswer.selectedOptionId);
      const isCorrect = userAnswer.selectedOptionId === correctOption.id;

      if (selectedOption) questionsAttempted++;
      if (isCorrect) {
        score += question.score;
        questionsCorrect++;
      } else {
        questionsIncorrect++;
      }

      evaluation.push({
        questionId: question.id,
        questionText: question.text,
        selectedOptionId: userAnswer.selectedOptionId,
        selectedOptionText: selectedOption?.text || null,
        correctOptionId: correctOption.id,
        correctOptionText: correctOption.text,
        isCorrect,
      });
    }

    // Store result
    await prisma.result.create({
      data: {
        studentId,
        quizId,
        score,
        totalScore,
        questionsAttempted,
        questionsCorrect,
        questionsIncorrect,
        timeTaken,
      },
    });

    res.status(200).json(new ApiResponse(200,data:{
      score,
      totalScore,
      questionsAttempted,
      questionsCorrect,
      questionsIncorrect,
      timeTaken,
      evaluation
    },"Quiz submitted successfully"));
  } catch (error) {
    next(error);
  }
})

// send which question is correct and which is wrong
export const getQuizReportController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

})

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
