import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { errorHandler } from "./Lib/error.handler";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import fs, { readFileSync } from "fs";
import admin from "firebase-admin";

const firebaseJsonPath = "./firebase-service.json";
const base64 = process.env.FIREBASE_SERVICE_JSON;
fs.writeFileSync(firebaseJsonPath, Buffer.from(base64, "base64"));

admin.initializeApp({
  credential: admin.credential.cert(firebaseJsonPath),
});

dotenv.config({
  path: "./.env",
});

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://quizmaster-five.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);
app.use(express.json());
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://quizmaster-56qn.onrender.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

export const prisma = new PrismaClient();

import AuthRoutes from "./routers/auth.routes";
import QuizRoutes from "./routers/quiz.routes";
import ResultRoutes from "./routers/result.routes";
import CategoryRoutes from "./routers/category.routes";
import RoomRoutes from "./routers/room.routes";

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/quiz", QuizRoutes);
app.use("/api/v1/result", ResultRoutes);
app.use("/api/v1/category", CategoryRoutes);
app.use("/api/v1/room", RoomRoutes);

const activeQuizSessions = new Map();

const socketToSession = new Map();

const roomStats = new Map();

io.on("connection", (socket) => {
  // console.log("User connected:", socket.id);

  socket.on("restore-session", async ({ sessionId, roomId }) => {
    try {
      // console.log("Restoring session:", sessionId, "for socket:", socket.id);

      if (sessionId) {
        const session = await prisma.quizSession.findUnique({
          where: { id: sessionId },
          include: { room: true },
        });

        if (session && session.status === "IN_PROGRESS") {
          // Store session info keyed by sessionId
          activeQuizSessions.set(sessionId, {
            sessionId: session.id,
            roomId: session.roomId || roomId,
            quizId: session.quizId,
            userId: session.studentId,
            studentProfileId: session.studentProfileId,
            startedAt: session.startedAt,
            socketId: socket.id,
          });

          socketToSession.set(socket.id, sessionId);

          if (session.roomId) {
            socket.join(session.roomId);
          }

          socket.emit("session-restored", {
            sessionId: session.id,
            roomId: session.roomId,
            quizId: session.quizId,
          });
          // console.log("Session restored successfully:", sessionId);
        } else {
          socket.emit("error", {
            message: "Session not found or already completed",
          });
        }
      }
    } catch (error) {
      console.error("Error restoring session:", error);
      socket.emit("error", { message: "Failed to restore session" });
    }
  });

  socket.on("start-quiz", async ({ quizId, userId, studentProfileId }) => {
    try {
      const session = await prisma.quizSession.create({
        data: {
          quizId,
          studentId: userId,
          studentProfileId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      activeQuizSessions.set(session.id, {
        sessionId: session.id,
        quizId,
        userId,
        studentProfileId,
        startedAt: session.startedAt,
        socketId: socket.id,
      });

      socketToSession.set(socket.id, session.id);

      socket.emit("quiz-started", { sessionId: session.id });
    } catch (error) {
      socket.emit("error", {
        message: "Unable to start quiz",
      });
    }
  });

  socket.on("save-answer", async ({ sessionId, questionId, optionId }) => {
    try {
      const sessionInfo = activeQuizSessions.get(sessionId);
      if (!sessionInfo) {
        socket.emit("error", {
          message: "Invalid session. Please refresh and try again.",
        });
        return;
      }

      if (sessionInfo.socketId !== socket.id) {
        sessionInfo.socketId = socket.id;
        socketToSession.set(socket.id, sessionId);
      }

      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: {
          options: true,
        },
      });

      if (!question) {
        socket.emit("error", { message: "Question not found" });
        return;
      }

      const selectedOption = question?.options.find(
        (opt) => opt.id === optionId
      );
      if (!selectedOption) {
        socket.emit("error", { message: "Invalid option selected" });
        return;
      }

      const isCorrect = selectedOption.isCorrect;

      const answer = await prisma.answer.upsert({
        where: {
          sessionId_questionId: {
            sessionId,
            questionId,
          },
        },
        update: {
          optionId,
          isCorrect: isCorrect || false,
          marksAwarded: isCorrect ? question?.marks : 0,
          answeredAt: new Date(),
        },
        create: {
          sessionId,
          questionId,
          optionId,
          isCorrect: isCorrect || false,
          marksAwarded: isCorrect ? question?.marks || 0 : 0,
        },
      });

      socket.emit("answer-saved", {
        questionId,
        optionId,
        message: "Answer saved successfully",
      });
    } catch (error) {
      console.error("Error saving answer:", error);
      socket.emit("error", { message: "Failed to save answer" });
    }
  });

  socket.on("submit-quiz", async ({ sessionId }) => {
    try {
      const sessionInfo = activeQuizSessions.get(sessionId);

      if (!sessionInfo) {
        socket.emit("error", {
          message:
            "No active quiz session found. Please refresh and try again.",
        });
        return;
      }

      if (sessionInfo.socketId !== socket.id) {
        sessionInfo.socketId = socket.id;
        socketToSession.set(socket.id, sessionId);
      }

      const currentTime = new Date();
      const timeSpentInSeconds = Math.floor(
        (currentTime - sessionInfo.startedAt) / 1000
      );

      const updatedSession = await prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          status: "SUBMITTED",
          submittedAt: currentTime,
          timeSpent: timeSpentInSeconds,
        },
        include: {
          answers: {
            include: {
              question: true,
              option: true,
            },
          },
          quiz: {
            include: {
              questions: true,
            },
          },
        },
      });

      const totalQuestions = updatedSession.quiz.questions.length;
      const questionsAttempted = updatedSession.answers.length;
      const questionsCorrect = updatedSession.answers.filter(
        (answer) => answer.isCorrect
      ).length;
      const questionsIncorrect = updatedSession.answers.filter(
        (answer) => answer.isCorrect === false
      ).length;
      const questionsSkipped = totalQuestions - questionsAttempted;
      const score = updatedSession.answers.reduce(
        (sum, answer) => sum + answer.marksAwarded,
        0
      );
      const totalMarks = updatedSession.quiz.questions.reduce(
        (sum, question) => sum + question.marks,
        0
      );
      let percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
      percentage = parseFloat(percentage.toFixed(2));
      const isPassed = percentage >= updatedSession.quiz.passingMarks;

      const existingResults = await prisma.result.findMany({
        where: {
          quizId: sessionInfo.quizId,
          studentId: sessionInfo.studentProfileId,
        },
      });

      const attemptNumber = existingResults.length + 1;

      const result = await prisma.result.create({
        data: {
          studentId: sessionInfo.studentProfileId,
          quizId: sessionInfo.quizId,
          sessionId: sessionId,
          score,
          totalMarks,
          percentage,
          questionsAttempted,
          questionsCorrect,
          questionsIncorrect,
          questionsSkipped,
          timeTaken: timeSpentInSeconds,
          isPassed,
          attemptNumber,
        },
      });

      await prisma.studentProfile.update({
        where: {
          id: sessionInfo.studentProfileId,
        },
        data: {
          points: {
            increment: questionsCorrect,
          },
        },
      });

      activeQuizSessions.delete(sessionId);
      socketToSession.delete(socket.id);

      const evaluation = [];

      const allQuestions = await prisma.question.findMany({
        where: { quizId: sessionInfo.quizId },
        include: {
          options: true,
        },
        orderBy: { order: "asc" },
      });

      for (const question of allQuestions) {
        const userAnswer = updatedSession.answers.find(
          (answer) => answer.question.id === question.id
        );

        const correctOption = question.options.find((opt) => opt.isCorrect);

        if (userAnswer) {
          evaluation.push({
            questionId: question.id,
            questionText: question.text,
            selectedOptionId: userAnswer.option?.id,
            selectedOptionText: userAnswer.option?.text,
            correctOptionId: correctOption?.id,
            correctOptionText: correctOption?.text,
            isCorrect: userAnswer.isCorrect,
            skipped: false,
            marksAwarded: userAnswer.marksAwarded,
            totalMarks: question.marks,
          });
        } else {
          evaluation.push({
            questionId: question.id,
            questionText: question.text,
            selectedOptionId: null,
            selectedOptionText: null,
            correctOptionId: correctOption?.id,
            correctOptionText: correctOption?.text,
            isCorrect: false,
            skipped: true,
            marksAwarded: 0,
            totalMarks: question.marks,
          });
        }
      }

      socket.emit("quiz-submitted", {
        success: true,
        result: {
          id: result.id,
          score,
          totalMarks,
          percentage: Math.round(percentage * 100) / 100,
          questionsAttempted,
          questionsCorrect,
          questionsIncorrect,
          questionsSkipped,
          timeTaken: timeSpentInSeconds,
          isPassed,
          attemptNumber,
          evaluation,
        },
        message: "Quiz submitted successfully",
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      socket.emit("error", { message: "Failed to submit quiz" });
    }
  });

  socket.on("join-room", async ({ roomCode, userId, studentProfileId }) => {
    try {
      const room = await prisma.room.findFirst({
        where: {
          roomCode: roomCode,
          endTime: {
            gt: new Date(),
          },
        },
      });

      if (!room) {
        socket.emit("error", { message: "Invalid room code or Room Expire" });
        return;
      }

      socket.join(room.id);

      if (!roomStats.has(room.id)) {
        roomStats.set(room.id, {
          studentsJoined: new Set(),
          highestScore: 0,
          totalSubmissions: 0,
        });
      }

      const stats = roomStats.get(room.id);
      const wasNewStudent = !stats.studentsJoined.has(studentProfileId);
      stats.studentsJoined.add(studentProfileId);

      const session = await prisma.quizSession.create({
        data: {
          quizId: room.quizId,
          roomId: room.id,
          studentId: userId,
          studentProfileId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      activeQuizSessions.set(session.id, {
        sessionId: session.id,
        roomId: room.id,
        quizId: room.quizId,
        userId,
        studentProfileId,
        startedAt: session.startedAt,
        socketId: socket.id,
      });

      socketToSession.set(socket.id, session.id);

      // Emit updated room stats to all clients in the room
      const roomStatsData = {
        studentsJoined: stats.studentsJoined.size,
        highestScore: stats.highestScore,
        totalSubmissions: stats.totalSubmissions,
      };
      // console.log(stats.studentsJoined.size)

      io.to(room.id).emit("room-stats-updated", roomStatsData);

      socket.emit("quiz-started", {
        sessionId: session.id,
        roomId: room.id,
        quizId: room.quizId,
        roomStatsData: roomStatsData,
      });
    } catch (error) {
      console.error("Join Room Error:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("submit-quiz-room", async ({ sessionId }) => {
    try {
      const sessionInfo = activeQuizSessions.get(sessionId);

      if (!sessionInfo) {
        socket.emit("error", {
          message: "No active session found. Please refresh and try again.",
        });
        return;
      }

      if (sessionInfo.socketId !== socket.id) {
        sessionInfo.socketId = socket.id;
        socketToSession.set(socket.id, sessionId);
      }

      const currentTime = new Date();
      const timeSpent = Math.floor(
        (currentTime - sessionInfo.startedAt) / 1000
      );

      const updatedSession = await prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          status: "SUBMITTED",
          submittedAt: currentTime,
          timeSpent,
        },
        include: {
          answers: { include: { question: true, option: true } },
          quiz: { include: { questions: true } },
        },
      });

      const totalQuestions = updatedSession.quiz.questions.length;
      const questionsAttempted = updatedSession.answers.length;
      const questionsCorrect = updatedSession.answers.filter(
        (a) => a.isCorrect
      ).length;
      const questionsIncorrect = updatedSession.answers.filter(
        (a) => a.isCorrect === false
      ).length;
      const questionsSkipped = totalQuestions - questionsAttempted;
      const score = updatedSession.answers.reduce(
        (sum, a) => sum + a.marksAwarded,
        0
      );
      const totalMarks = updatedSession.quiz.questions.reduce(
        (sum, q) => sum + q.marks,
        0
      );
      const percentage = parseFloat(((score / totalMarks) * 100).toFixed(2));
      const isPassed = percentage >= updatedSession.quiz.passingMarks;

      const attemptNumber =
        (await prisma.result.count({
          where: {
            quizId: sessionInfo.quizId,
            studentId: sessionInfo.studentProfileId,
          },
        })) + 1;

      const result = await prisma.result.create({
        data: {
          studentId: sessionInfo.studentProfileId,
          quizId: sessionInfo.quizId,
          sessionId,
          score,
          totalMarks,
          percentage,
          questionsAttempted,
          questionsCorrect,
          questionsIncorrect,
          questionsSkipped,
          timeTaken: timeSpent,
          isPassed,
          attemptNumber,
        },
      });

      await prisma.studentProfile.update({
        where: { id: sessionInfo.studentProfileId },
        data: { points: { increment: questionsCorrect } },
      });

      // Update room stats with the new submission
      if (roomStats.has(sessionInfo.roomId)) {
        const stats = roomStats.get(sessionInfo.roomId);
        stats.totalSubmissions += 1;
        if (score > stats.highestScore) {
          stats.highestScore = score;
        }

        // Emit updated room stats to all clients in the room
        io.to(sessionInfo.roomId).emit("room-stats-updated", {
          studentsJoined: stats.studentsJoined.size,
          highestScore: stats.highestScore,
          totalSubmissions: stats.totalSubmissions,
        });
      }

      // Get all submissions for room report
      const submissions = await prisma.quizSession.findMany({
        where: { roomId: sessionInfo.roomId, status: "SUBMITTED" },
        include: { result: true },
      });

      const totalSubmissions = submissions.length;
      const scores = submissions.map((s) => s.result?.score ?? 0);
      const times = submissions.map((s) => s.timeSpent);

      if (sessionInfo.roomId) {
        io.to(sessionInfo.roomId).emit("room-report-updated", {
          totalSubmissions,
          highestScore: Math.max(...scores),
          averageScore: parseFloat(
            (scores.reduce((a, b) => a + b, 0) / totalSubmissions).toFixed(2)
          ),
          lowestTime: Math.min(...times),
        });
      }

      activeQuizSessions.delete(sessionId);
      socketToSession.delete(socket.id);

      const evaluation = [];

      const allQuestions = await prisma.question.findMany({
        where: { quizId: sessionInfo.quizId },
        include: {
          options: true,
        },
        orderBy: { order: "asc" },
      });

      for (const question of allQuestions) {
        const userAnswer = updatedSession.answers.find(
          (answer) => answer.question.id === question.id
        );

        const correctOption = question.options.find((opt) => opt.isCorrect);

        if (userAnswer) {
          evaluation.push({
            questionId: question.id,
            questionText: question.text,
            selectedOptionId: userAnswer.option?.id,
            selectedOptionText: userAnswer.option?.text,
            correctOptionId: correctOption?.id,
            correctOptionText: correctOption?.text,
            isCorrect: userAnswer.isCorrect,
            skipped: false,
            marksAwarded: userAnswer.marksAwarded,
            totalMarks: question.marks,
          });
        } else {
          evaluation.push({
            questionId: question.id,
            questionText: question.text,
            selectedOptionId: null,
            selectedOptionText: null,
            correctOptionId: correctOption?.id,
            correctOptionText: correctOption?.text,
            isCorrect: false,
            skipped: true,
            marksAwarded: 0,
            totalMarks: question.marks,
          });
        }
      }

      socket.emit("quiz-submitted", {
        success: true,
        result: {
          id: result.id,
          score,
          totalMarks,
          percentage: Math.round(percentage * 100) / 100,
          questionsAttempted,
          questionsCorrect,
          questionsIncorrect,
          questionsSkipped,
          timeTaken: timeSpent,
          isPassed,
          attemptNumber,
          evaluation,
        },
        message: "Quiz submitted successfully",
      });
    } catch (err) {
      console.error("Submit Error:", err);
      socket.emit("error", { message: "Failed to submit quiz" });
    }
  });

  socket.on("disconnect", () => {
    // console.log("User disconnected:", socket.id);

    const sessionId = socketToSession.get(socket.id);
    if (sessionId) {
      socketToSession.delete(socket.id);
      // console.log("Socket disconnected but session preserved:", sessionId);
    }
    roomStats.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);

        io.to(roomId).emit("roomStats", {
          roomId,
          users: Array.from(users),
          count: users.size,
        });

        // Optional cleanup
        if (users.size === 0) {
          roomStats.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 4040;
server.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

app.use(errorHandler);
