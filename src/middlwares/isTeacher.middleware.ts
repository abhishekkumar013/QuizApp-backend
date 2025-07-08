import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import { CustomError } from "../Lib/error.handler";
import prisma from "../Lib/prisma";

export const isTeacher = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userrole = req.user?.role;
      const id = req.user?.id;
      const isTeacher = await prisma.teacherProfile.findFirst({
        where: {
          userId: id,
        },
      });
      if (!userrole || userrole !== "TEACHER" || !isTeacher) {
        throw new CustomError("Unauthorized", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);
