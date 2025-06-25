import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import cookieParser from "cookie-parser";
import { errorHandler } from "./Lib/error.handler";
import { PrismaClient } from "@prisma/client";

dotenv.config({
  path: "./.env",
});
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

export const prisma = new PrismaClient();

import AuthRoutes from "./routers/auth.routes";
import QuizRoutes from "./routers/quiz.routes";
import ResultRoutes from "./routers/result.routes";
import CategoryRoutes from "./routers/category.routes";

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/quiz", QuizRoutes);
app.use("/api/v1/result", ResultRoutes);
app.use("/api/v1/category", CategoryRoutes);

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

app.use(errorHandler);
