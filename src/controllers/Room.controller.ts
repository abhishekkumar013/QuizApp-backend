import { json, type NextFunction, type Request, type Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import prisma from "../Lib/prisma";
import { CustomError } from "../Lib/error.handler";
import { nanoid } from "nanoid";
import { ApiResponse } from "../Lib/apiResponse";

export const joinRoomController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomCode, userId } = req.body;

      const room = await prisma.room.findUnique({
        where: {
          roomCode,
        },
        include: {
          quiz: {
            include: {
              questions: {
                include: {
                  options: true,
                },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });
      if (!room) {
        throw new CustomError("Invalid Room Code", 404);
      }

      const now = new Date();

      if (now < room.startTime || now > room.endTime) {
        throw new CustomError("Quiz is not available at this time", 403);
      }

      const quizEndDiffMs = now.getTime() - room.endTime.getTime();
      const quiztime = Math.floor(quizEndDiffMs / (1000 * 60));

      const remainingTime =
        quiztime < room.quiz.durationInMinutes
          ? quiztime
          : room.quiz.durationInMinutes;

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            roomId: room.id,
            quizId: room.quizId,
            quiz: {
              title: room.quiz.title,
              description: room.quiz.description,
              durationInMinutes: remainingTime,
              totalMarks: room.quiz.totalMarks,
              questions: room.quiz.questions.map((q) => ({
                id: q.id,
                text: q.text,
                order: q.order,
                options: q.options.map((opt) => ({
                  id: opt.id,
                  text: opt.text,
                })),
              })),
            },
          },
          "welcome to room"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const createRoomController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = req.user?.roleId;
      const { quizId, title, startTime, endTime, showReport } = req.body;

      if (!quizId) {
        throw new CustomError("QuizId Required", 404);
      }
      if (!startTime || !endTime || !showReport) {
        throw new CustomError("All fields Required", 404);
      }

      const isquiz = await prisma.quiz.findUnique({
        where: {
          id: quizId,
        },
      });
      if (!isquiz) {
        throw new CustomError("Invalid QuizId", 404);
      }

      let roomCode: string;
      while (true) {
        const code = nanoid(8);
        const isRoom = await prisma.room.findFirst({
          where: { roomCode: code },
        });
        if (!isRoom) {
          roomCode = code;
          break;
        }
      }

      const room = await prisma.room.create({
        data: {
          quizId: isquiz.id,
          teacherId: roleId,
          roomCode: roomCode,
          title: title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          showReport: showReport,
        },
      });

      if (!room) {
        throw new CustomError("Error in room Creation! Try Again!", 400);
      }
      return res.status(200).json(new ApiResponse(200, room, "room created!"));
    } catch (error) {
      next(error);
    }
  }
);

export const getAllRoomController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = req.user?.roleId;

      const rooms = await prisma.room.findMany({
        where: {
          teacherId: roleId,
        },
        include: {
          quiz: {
            select: {
              title: true,
            },
          },
        },
      });

      if (!rooms) {
        throw new CustomError("No room found", 404);
      }
      const now = new Date();

      const roomData = rooms.map((room) => ({
        ...room,
        isActive: now <= room.endTime,
      }));

      return res
        .status(200)
        .json(new ApiResponse(200, roomData, "All room fetched"));
    } catch (error) {
      next(error);
    }
  }
);

export const getRoomReportController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          quiz: true,
        },
      });

      if (!room) {
        throw new CustomError("Room not found", 404);
      }

      if (!room.showReport) {
        return res
          .status(403)
          .json(new ApiResponse(403, {}, "Report not available for this room"));
      }

      const sessions = await prisma.quizSession.findMany({
        where: {
          roomId: roomId,
          status: "SUBMITTED",
        },
        include: {
          result: true,
        },
      });

      const totalSubmissions = sessions.length;

      if (totalSubmissions === 0) {
        return res.status(200).json(
          new ApiResponse(
            200,
            {
              totalSubmissions: 0,
              highestScore: 0,
              averageScore: 0,
              lowestTime: 0,
              results: [],
            },
            "No submissions yet"
          )
        );
      }

      const scores = sessions.map((s) => s.result?.score ?? 0);
      const times = sessions.map((s) => s.timeSpent);

      const highestScore = Math.max(...scores);
      const averageScore = parseFloat(
        (scores.reduce((a, b) => a + b, 0) / totalSubmissions).toFixed(2)
      );
      const lowestTime = Math.min(...times);

      const report = sessions.map((s) => ({
        studentId: s.studentId,
        score: s.result?.score,
        percentage: s.result?.percentage,
        timeTaken: s.timeSpent,
        isPassed: s.result?.isPassed,
      }));

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            roomId,
            quizTitle: room.quiz.title,
            totalSubmissions,
            highestScore,
            averageScore,
            lowestTime,
            results: report,
          },
          "Room report generated"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);
