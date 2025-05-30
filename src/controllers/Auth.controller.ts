import asyncHandler from "../Lib/asynchHandler";
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../Lib/error.handler";
import prisma from "../Lib/prisma";
import { comparePassword, hashPassword } from "../Lib/hash.bcrypt";
import { generateToken } from "../Lib/jwt";
import { ApiResponse } from "../Lib/apiResponse";

export const SignUpController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password || !role) {
        throw new CustomError("All fields required", 400);
      }

      const isUser = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (isUser) {
        throw new CustomError("user already exist", 400);
      }

      const bcryptPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name,
          email,
          password: bcryptPassword,
          role,
        },
      });

      return res
        .status(200)
        .json(new ApiResponse(200, user, "Account Created successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const SignInController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new CustomError("All fields required", 400);
      }

      const isUser = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });
      if (!isUser) {
        throw new CustomError("No Account Found", 404);
      }
      const isPasswordCorrect = await comparePassword(
        password,
        isUser.password
      );
      if (!isPasswordCorrect) {
        throw new CustomError("Invalid credentails", 400);
      }

      const token = await generateToken({ id: isUser.id });
      res
        .cookie("token", token, {
          httpOnly: true,
          //   secure: true, // use only on HTTPS
          //   sameSite: "strict",
        })
        .status(200)
        .json(
          new ApiResponse(200, {
            id: isUser.id,
            email: isUser.email,
            name: isUser.name,
          ,role:isUser.role},"login successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);
