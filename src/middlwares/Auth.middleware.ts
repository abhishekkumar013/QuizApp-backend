import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import { CustomError } from "../Lib/error.handler";
import { verifyToken } from "../Lib/jwt";
import prisma from "../Lib/prisma";

export const isAuthenticated = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.token || req.header("Authorization");

      if (!token) {
        throw new CustomError("Unauthorized", 401);
      }
      const dcodedToken = await verifyToken(token);
      if (!dcodedToken) {
        throw new CustomError("Invalid token", 401);
      }
      const user = await prisma.user.findFirst({
        where: {
          id: dcodedToken.id,
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      });
      if (!user) {
        throw new CustomError("Unauthorized", 404);
      }
      req.user = user;
      req.user.roleId = dcodedToken.roleId;
      req.user.token = token;
      next();
    } catch (error) {
      next(error);
    }
  }
);
