import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { errorHandler } from "./Lib/error.handler";

dotenv.config({
  path: "./.env",
});
const app = express();
app.use(cors());
app.use(express.json());

app.get("/hello", (req, res) => {
  res.send("Welcome to the API!");
});
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});

app.use(errorHandler);
