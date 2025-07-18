import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { errorHandler } from "./Lib/error.handler";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import fs,{ readFileSync } from "fs";
import admin from "firebase-admin";

// const serviceAccountPath = path.resolve(__dirname, "../firebase-service-account.json");
// const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

const firebaseJsonPath = "./firebase-service.json";
const base64 = process.env.FIREBASE_SERVICE_JSON;
fs.writeFileSync(firebaseJsonPath, Buffer.from(base64, 'base64'));

// Then initialize firebase using this file

admin.initializeApp({
  credential: admin.credential.cert(firebaseJsonPath),
});


dotenv.config({
  path: "./.env",
});

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);
app.use(express.json());
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

export const prisma = new PrismaClient();

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }


import AuthRoutes from "./routers/auth.routes";
import QuizRoutes from "./routers/quiz.routes";
import ResultRoutes from "./routers/result.routes";
import CategoryRoutes from "./routers/category.routes";

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/quiz", QuizRoutes);
app.use("/api/v1/result", ResultRoutes);
app.use("/api/v1/category", CategoryRoutes);

// Store active quiz sessions
const activeQuizSessions = new Map();

io.on("connection", (socket) => {
  // console.log("User connected:", socket.id);

  socket.on("start-quiz", async ({ quizId, userId, studentProfileId }) => {
    try {
      // console.log(studentProfileId);
      const session = await prisma.quizSession.create({
        data: {
          quizId,
          studentId: userId,
          studentProfileId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      // Store the session info for this socket
      activeQuizSessions.set(socket.id, {
        sessionId: session.id,
        quizId,
        userId,
        studentProfileId,
        startedAt: session.startedAt,
      });

      socket.emit("quiz-started", { sessionId: session.id });
    } catch (error) {
      console.error("Error starting quiz:", error);
      socket.emit("error", {
        message: "Unable to start quiz",
      });
    }
  });

  socket.on("save-answer", async ({ sessionId, questionId, optionId }) => {
    try {
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
      const sessionInfo = activeQuizSessions.get(socket.id);

      if (!sessionInfo) {
        socket.emit("error", { message: "No active quiz session found" });
        return;
      }

      // Calculate time spent
      const currentTime = new Date();
      const timeSpentInSeconds = Math.floor(
        (currentTime - sessionInfo.startedAt) / 1000
      );

      // Update the quiz session
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

      // Calculate results
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

      // Get the current attempt number
      const existingResults = await prisma.result.findMany({
        where: {
          quizId: sessionInfo.quizId,
          studentId: sessionInfo.studentProfileId,
        },
      });

      const attemptNumber = existingResults.length + 1;

      // Create the result record
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

      // increment point by correct quuestion
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
      

      // Remove from active sessions
      activeQuizSessions.delete(socket.id);

      // Prepare detailed evaluation for the report
      const evaluation = [];

      // Get all questions for the quiz
      const allQuestions = await prisma.question.findMany({
        where: { quizId: sessionInfo.quizId },
        include: {
          options: true,
        },
        orderBy: { order: "asc" },
      });

      // Create evaluation for each question
      for (const question of allQuestions) {
        const userAnswer = updatedSession.answers.find(
          (answer) => answer.question.id === question.id
        );

        const correctOption = question.options.find((opt) => opt.isCorrect);

        if (userAnswer) {
          // Question was attempted
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
          // Question was skipped
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

      // Send result without auto-disconnect
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

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Clean up active session data
    activeQuizSessions.delete(socket.id);
  });
});

const PORT = process.env.PORT || 4040;
server.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

app.use(errorHandler);
