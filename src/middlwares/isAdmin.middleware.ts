import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import { CustomError } from "../Lib/error.handler";
import prisma from "../Lib/prisma";

export const isAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userrole = req.user?.role;
      const actualrole = req.user?.id;
      const getrole = await prisma.user.findUnique({
        where: {
          id: actualrole,
        },
        select: {
          role: true,
        },
      });
      if (!userrole || userrole !== "ADMIN" || getrole?.role !== "ADMIN") {
        throw new CustomError("Unauthorized", 403);
      }
      const roleId = req.user?.roleId;
      if (!roleId) {
        throw new CustomError("Role ID not found", 400);
      }
      const isVerified = await prisma.adminProfile.findFirst({
        where: {
          id: roleId,
        },
        select: {
          isVerified: true,
        },
      });
      if (!isVerified) {
        throw new CustomError("Admin profile not found", 404);
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);
