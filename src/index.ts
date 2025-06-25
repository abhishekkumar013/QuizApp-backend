import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import cookieParser from "cookie-parser";
import { errorHandler } from "./Lib/error.handler";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import http from "http";

dotenv.config({
  path: "./.env",
});
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", " PUT", "DELETE", "PATCH"],
  },
});

export const prisma = new PrismaClient();

import AuthRoutes from "./routers/auth.routes";
import QuizRoutes from "./routers/quiz.routes";
import ResultRoutes from "./routers/result.routes";
import CategoryRoutes from "./routers/category.routes";

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/quiz", QuizRoutes);
app.use("/api/v1/result", ResultRoutes);
app.use("/api/v1/category", CategoryRoutes);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start-quiz", async ({ quizId, userId, studentProfileId }) => {
    try {
      const session = await prisma.quizSession.create({
        data: {
          quizId,
          studentId: userId,
          studentProfileId,
        },
      });

      socket.emit("quiz-started", { sessionId: session.id });
    } catch (error) {
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

      const isOption = question?.options.find((opt) => opt.id === optionId);
      if (!isOption) {
        socket.emit("error", { message: "Invalid option selected" });
        return;
      }

      const isCorrect = question?.options.find(
        (opt) => opt.id === optionId
      )?.isCorrect;

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
      socket.emit("error", { message: "Failed to save answer" });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

app.use(errorHandler);
