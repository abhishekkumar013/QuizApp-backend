import type { NextFunction, Request, Response } from "express";
import asyncHandler from "../Lib/asynchHandler";
import { CustomError } from "../Lib/error.handler";
// import prisma from "../Lib/prisma";
import { prisma } from "../index";
import { ApiResponse } from "../Lib/apiResponse";

export const createCategoryController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;

      if (!name) {
        throw new CustomError("Category name is required", 400);
      }
      const categoryName = name.trim().toUpperCase();
      const existingCategory = await prisma.category.findUnique({
        where: { name: categoryName },
      });
      if (existingCategory) {
        throw new CustomError("Category already exists", 400);
      }
      const newcategory = await prisma.category.create({
        data: { name: categoryName },
      });

      return res
        .status(200)
        .json(new ApiResponse(200, newcategory, "New Category Created"));
    } catch (error) {
      next(error);
    }
  }
);

export const getAllCategoryController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: {
          name: "asc",
        },
      });
      if (!categories || categories.length === 0) {
        throw new CustomError("No categories found", 404);
      }
      return res
        .status(200)
        .json(new ApiResponse(200, categories, "All Categories"));
    } catch (error) {
      next(error);
    }
  }
);

export const deleteCategoryController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new CustomError("Category ID is required", 400);
      }
      const category = await prisma.category.findUnique({
        where: { id },
      });
      if (!category) {
        throw new CustomError("Category not found", 404);
      }
      await prisma.category.delete({
        where: { id },
      });
      return res
        .status(200)
        .json(new ApiResponse(200, null, "Category deleted successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const updateCategoryCotroller = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params?.id;
      const { name } = req.body;

      if (!id) {
        throw new CustomError("Category ID is required", 400);
      }
      if (!name) {
        throw new CustomError("Category name is required", 400);
      }
      const categoryName = name.trim().toUpperCase();

      const isCatgeory = await prisma.category.findFirst({
        where: { id },
      });
      if (!isCatgeory) {
        throw new CustomError("Category not found", 404);
      }
      const updatedCategory = await prisma.category.update({
        where: { id },
        data: { name: categoryName },
      });
      return res
        .status(200)
        .json(
          new ApiResponse(200, updatedCategory, "Category updated successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);
