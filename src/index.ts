import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import cookieParser from "cookie-parser";
import { errorHandler } from "./Lib/error.handler";

dotenv.config({
  path: "./.env",
});
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

import AuthRoutes from "./routers/auth.routes";
import QuizRoutes from "./routers/quiz.routes";
import ResultRoutes from "./routers/result.routes";

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/quiz", QuizRoutes);
app.use("/api/v1/result", ResultRoutes);

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

app.use(errorHandler);
