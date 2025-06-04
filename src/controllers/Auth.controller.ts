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
    const users=await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

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

export const updateStudentParentController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.params.id; 
    const { newParentId } = req.body; 

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: studentUserId }
    });

    if (!studentProfile) {
      throw new CustomError("Student profile not found", 404);
    }

    const parentUser = await prisma.user.findUnique({
      where: { id: newParentId }
    });

    if (!parentUser || parentUser.role !== "PARENT") {
      throw new CustomError("Invalid parent user ID", 400);
    }

    const updatedProfile = await prisma.studentProfile.update({
      where: { userId: studentUserId },
      data: { parentId: newParentId }
    });

    res.status(200).json(new ApiResponse(200, updatedProfile, "Parent updated successfully"));
  } catch (error) {
    next(error);
  }
});

export const addChildToParentController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentUserId = req.params.parentId; // Parent's user ID
    const { childUserId } = req.body; // Student's user ID

    const parentUser = await prisma.user.findUnique({
      where: { id: parentUserId }
    });

    if (!parentUser || parentUser.role !== "PARENT") {
      throw new CustomError("Invalid parent ID", 400);
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: childUserId }
    });

    if (!studentProfile) {
      throw new CustomError("Student profile not found", 404);
    }

    const updatedStudentProfile = await prisma.studentProfile.update({
      where: { userId: childUserId },
      data: { parentId: parentUserId }
    });

    res.status(200).json(new ApiResponse(200, updatedStudentProfile, "Child added to parent successfully"));
  } catch (error) {
    next(error);
  }
});


export const getAllStudentController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!students || students.length === 0) {
      throw new CustomError("No students found", 404);
    }

    res.status(200).json(new ApiResponse(200, students, "Students fetched successfully"));
  } catch (error) {
    next(error);
  }
});

const getAllParentsController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parents=await  prisma.parentProfile.findMany({
      include:{
        user:{
          select:{
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      }
    })

    if(!parents || parents.length === 0) {
      throw new CustomError("No parents found", 404);
    }
    res.status(200).json(new ApiResponse(200, parents, "Parents fetched successfully"));
  } catch (error) {
    next(error);
  }
})

export const getAllTeachersController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teachers=await prisma.user.findMany({
      where: {
        role: "TEACHER"
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }
    })
    if (!teachers || teachers.length === 0) {
      throw new CustomError("No teachers found", 404);
    }
    res.status(200).json(new ApiResponse(200, teachers, "Teachers fetched successfully"));
  } catch (error) {
    next(error)
  }
})

export const searchStudentController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.params.name || req.query.name as string;

    if (!searchTerm) {
      throw new CustomError("Search term is required", 400);
    }

    const students = await prisma.studentProfile.findMany({
      where: {
        user: {
          name: {
            contains: searchTerm,
            mode: "insensitive", 
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!students || students.length === 0) {
      throw new CustomError("No students found", 404);
    }

    res.status(200).json(new ApiResponse(200, students, "Students fetched successfully"));
  } catch (error) {
    next(error);
  }
});
export const searchParentController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.params.name || req.query.name as string;

    if (!searchTerm) {
      throw new CustomError("Search term is required", 400);
    }

    const parents = await prisma.parentProfile.findMany({
      where: {
        user: {
          name: {
            contains: searchTerm,
            mode: "insensitive", 
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!parents || parents.length === 0) {
      throw new CustomError("No parents found", 404);
    }

    res.status(200).json(new ApiResponse(200, parents, "Parents fetched successfully"));
  } catch (error) {
    next(error);
  }
});

export const searchTeacherController = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.params.name || req.query.name as string;
    if (!searchTerm) {
      throw new CustomError("Search term is required", 400);
    }

    const teachers=await prisma.user.findMany({
      where:{
        role: "TEACHER",
        name: {
          contains: searchTerm,
          mode: "insensitive", 
        },
      },
      select:{
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }
    })
    if (!teachers || teachers.length === 0) {
      throw new CustomError("No teachers found", 404);
    }

    res.status(200).json(new ApiResponse(200, teachers, "Teachers fetched successfully"));
    
  } catch (error) {
    next(error)
  }
})