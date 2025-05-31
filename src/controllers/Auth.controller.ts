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

export const SignOutController = asyncHandler(async(req:Request, res:Response, next:NextFunction)=>{
  try {
    res
      .clearCookie("token")
      .status(200)
      .json(new ApiResponse(200, null, "Logout successfully"));
  } catch (error) {
    next(error);
  }
})

export const GetUserController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try{
    const users=await prisma.user.findMany({})

    res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"));
  }catch(error){
    next(error);
  }
})

export const SearchUsersController=asyncHandler(async(req:Request,res:Response,next:NextFunction)=>{
  try {
     const searchParams = req.params.search;
    
    const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: searchParams, mode: "insensitive" } },
            { email: { contains: searchParams, mode: "insensitive" } }
          ]
        }
      });


      if(!users){
        throw new CustomError('No User found',404)
      }

      return res.status(200).json(ApiResponse(200,users,'users fetched successfully'))
  } catch (error) {
    next(error)
  }
})

export const updateUserController=asyncHandler(async(req:Request,res:Response,next:NextFunction)=>{
  try {
    const id=req.params.id

    const {name,role,email}=req.body

    const user=await prisma.user.findFirst({
      where:{
        id:id
      }
    })
    if(!user){
      throw new CustomError('Invalid User Id || User not found',404)
    }

    const updateddata:any={}
    if(name) updateddata.name=name
    if (role) updateddata.role = role;
    if (email) updateddata.email = email;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateddata,
    });
     

    const user={
      name:updatedUser.name,
      email:updatedUser.email,
      role:updatedUser.role
    }
    return res.status(200).json(ApiResponse(200,user,'user updated successfully'))

  } catch (error) {
    next(error)
  }
})

export const resetPasswordController=asyncHandler(async(req:Request,res:Response,next:NextFunction)=>{
  try {
    const id=req.params?.id

    const {oldPassword,newPassword}=req.body

    if(!oldPassword || !newPassword){
      throw new CustomError('All fields are required',400)
    }
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new CustomError("User not found", 404);
    }
    const isPasswordCorrect = await comparePassword(oldPassword, user.password);
    if (!isPasswordCorrect) {
      throw new CustomError("Invalid old password", 400);
    }
    const hashedNewPassword = await hashPassword(newPassword);
    
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });

    return res.status(200).json(new ApiResponse(200, null, "Password reset successfully"));
  } catch (error) {
    next(error)
  }
})