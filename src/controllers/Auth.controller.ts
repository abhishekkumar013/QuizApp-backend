import asyncHandler from "../Lib/asynchHandler";
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../Lib/error.handler";
// import prisma from "../Lib/prisma";
import { prisma } from "../index";
import { comparePassword, hashPassword } from "../Lib/hash.bcrypt";
import { generateToken } from "../Lib/jwt";
import { ApiResponse } from "../Lib/apiResponse";
import { isValidRole, Role } from "../utils";

export const SignUpController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        email,
        password,
        role,
        parentEmail,
        phone,
        experienceYears,
      } = req.body;

      if (!name || !email || !password || !role) {
        throw new CustomError("All fields required", 400);
      }
      if (!isValidRole(role)) {
        throw new CustomError("Invalid Role", 400);
      }

      const isUser = await prisma.user.findUnique({
        where: {
          role_email: {
            role,
            email,
          },
        },
      });

      if (isUser) {
        throw new CustomError("user already exist", 400);
      }

      const bcryptPassword = await hashPassword(password);
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: name,
            email,
            password: bcryptPassword,
            role,
          },
        });

        switch (role) {
          case "STUDENT":
            let parentId = null;
            if (parentEmail) {
              const parent = await tx.user.findUnique({
                where: {
                  role_email: {
                    role: "PARENT",
                    email: parentEmail,
                  },
                },
              });
              parentId = parent?.id || null;
            }
            await tx.studentProfile.create({
              data: {
                userId: user.id,
                parentId,
              },
            });
            break;
          case "TEACHER":
            await tx.teacherProfile.create({
              data: {
                userId: user.id,
                phone: phone || null,
                experienceYears: experienceYears || 0,
              },
            });
            break;
          case "PARENT":
            await tx.parentProfile.create({
              data: {
                userId: user.id,
                phone: phone || null,
              },
            });
            break;
          case "ADMIN":
            await tx.adminProfile.create({
              data: {
                userId: user.id,
                phone: phone || null,
              },
            });
            break;
          default:
            throw new CustomError("Invalid Role", 400);
        }
        return user;
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { user: result },
            "Account Created successfully  With Role: " + role
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

export const SignInController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body;

      if (!email || !password || !role) {
        throw new CustomError("All fields required", 400);
      }

      const isUser = await prisma.user.findUnique({
        where: {
          role_email: {
            role,
            email,
          },
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

      let roleId = null;

      switch (role) {
        case "STUDENT":
          const studentrole = await prisma.studentProfile.findFirst({
            where: {
              userId: isUser.id,
            },
            select: {
              id: true,
            },
          });
          roleId = studentrole?.id;
          break;
        case "PARENT":
          const parentRole = await prisma.parentProfile.findFirst({
            where: {
              userId: isUser.id,
            },
            select: {
              id: true,
            },
          });
          roleId = parentRole?.id;
          break;
        case "TEACHER":
          const teacherRole = await prisma.teacherProfile.findFirst({
            where: {
              userId: isUser.id,
            },
            select: {
              id: true,
            },
          });
          roleId = teacherRole?.id;
          break;
        case "ADMIN":
          const adminRole = await prisma.adminProfile.findFirst({
            where: {
              userId: isUser.id,
            },
            select: {
              id: true,
            },
          });
          roleId = adminRole?.id;
          break;
        default:
          throw new CustomError("Invalid Role", 400);
      }

      if (!roleId) {
        throw new CustomError(`${role} profile not found`, 404);
      }

      const token = await generateToken({
        id: isUser.id,
        roleId: roleId,
        role: isUser.role,
        email: isUser.email,
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .status(200)
        .json(
          new ApiResponse(
            200,
            {
              id: isUser.id,
              email: isUser.email,
              name: isUser.name,
              role: isUser.role,
              token: token,
              roleId: roleId,
            },
            "login successfully"
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

export const VerifyUserController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.user?.id;

      if (!id) {
        throw new CustomError("Login Please!", 400);
      }

      return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User verified successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const SignOutController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .clearCookie("token")
        .status(200)
        .json(new ApiResponse(200, null, "Logout successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const LinkParentStudentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentEmail, parentEmail } = req.body;

      if (!studentEmail || !parentEmail) {
        throw new CustomError(
          "Both student and parent emails are required",
          400
        );
      }

      // Find student
      const student = await prisma.user.findUnique({
        where: {
          role_email: {
            role: "STUDENT",
            email: studentEmail,
          },
        },
        include: {
          studentProfile: true,
        },
      });

      if (!student || !student.studentProfile) {
        throw new CustomError("Student not found", 404);
      }

      // Find parent
      const parent = await prisma.user.findUnique({
        where: {
          role_email: {
            role: "PARENT",
            email: parentEmail,
          },
        },
      });

      if (!parent) {
        throw new CustomError("Parent not found", 404);
      }

      // Update student profile with parent ID
      const updatedProfile = await prisma.studentProfile.update({
        where: {
          id: student.studentProfile.id,
        },
        data: {
          parentId: parent.id,
        },
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            updatedProfile,
            "Parent-student link created successfully"
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

export const switchUserRoleController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, targetRole } = req.body;

      if (!email || !targetRole) {
        throw new CustomError("Email and target role are required", 400);
      }
      const user = await prisma.user.findUnique({
        where: {
          role_email: {
            role: targetRole,
            email: email,
          },
        },
        include: {
          studentProfile: true,
          parentProfile: true,
          teacherProfile: true,
        },
      });

      if (!user) {
        throw new CustomError("User not found with the specified role", 404);
      }

      // const token = await generateToken({
      //   id: user.id,
      //   role: user.role,
      //   email: user.email,
      // });

      res.status(200).json(
        new ApiResponse(
          200,
          {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            profile:
              user.role === "STUDENT"
                ? user.studentProfile
                : user.role === "PARENT"
                ? user.parentProfile
                : user.role === "TEACHER"
                ? user.teacherProfile
                : null,
          },
          "User role switched successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const GetUserController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res
        .status(200)
        .json(new ApiResponse(200, users, "Users fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const SearchUsersController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchParams = req.params.search;
      const { limit = 10, page = 1 } = req.query;

      const users = await prisma.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: searchParams, mode: "insensitive" } },
                { email: { contains: searchParams, mode: "insensitive" } },
              ],
            },
            {
              role: {
                not: "ADMIN",
              },
            },
          ],
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      });

      if (!users || users.length === 0) {
        throw new CustomError("No User found", 404);
      }

      const groupedUsers = users.reduce((acc: any[], user) => {
        const existingUser = acc.find((u) => u.email === user.email);

        if (existingUser) {
          // If user with same email exists, add role to array if not already present
          if (!existingUser.role.includes(user.role)) {
            existingUser.role.push(user.role);
          }
        } else {
          // Create new user entry with role as array
          acc.push({
            id: user.id,
            name: user.name,
            email: user.email,
            role: [user.role],
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          });
        }

        return acc;
      }, []);

      //--------------- Convert single-role arrays back to strings for consistency-------------------------

      // const processedUsers = groupedUsers.map((user) => ({
      //   ...user,
      //   role: user.role.length === 1 ? user.role[0] : user.role,
      // }));

      return res
        .status(200)
        .json(new ApiResponse(200, groupedUsers, "users fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const updateUserController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const { name, role, email } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: {
          id: id,
        },
      });

      if (!existingUser) {
        throw new CustomError("Invalid User Id || User not found", 404);
      }

      const updatedData: any = {};
      if (name) updatedData.name = name;
      if (role) updatedData.role = role;
      if (email) updatedData.email = email;

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updatedData,
      });

      const userResponse = {
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      };

      return res
        .status(200)
        .json(new ApiResponse(200, userResponse, "user updated successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const resetPasswordController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = (req as any).user?.id;

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        throw new CustomError("All fields are required", 400);
      }
      const user = await prisma.user.findUnique({
        where: { id },
      });
      if (!user) {
        throw new CustomError("User not found", 404);
      }
      const isPasswordCorrect = await comparePassword(
        oldPassword,
        user.password
      );
      if (!isPasswordCorrect) {
        throw new CustomError("Invalid old password", 400);
      }
      const hashedNewPassword = await hashPassword(newPassword);

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { password: hashedNewPassword },
      });

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Password reset successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const updateStudentParentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentUserId = req.user?.roleId;
      const { newParentId, email } = req.body;

      const studentProfile = await prisma.studentProfile.findFirst({
        where: { id: studentUserId },
      });

      if (!studentProfile) {
        throw new CustomError("Student profile not found", 404);
      }

      const parentUser = await prisma.parentProfile.findFirst({
        where: {
          OR: [
            { id: newParentId },
            {
              user: {
                email: email,
              },
            },
          ],
        },
      });

      if (!parentUser) {
        throw new CustomError("Invalid parent user ID", 400);
      }
      // console.log(parentUser);

      const updatedProfile = await prisma.studentProfile.update({
        where: {
          id: studentUserId,
        },
        data: {
          parentId: parentUser.userId,
        },
      });

      res
        .status(200)
        .json(
          new ApiResponse(200, updatedProfile, "Parent updated successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);

export const updateUserProfileController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      const updates = req.body;

      if (updates.name || updates.email) {
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            ...(updates.name && { name: updates.name }),
            ...(updates.email && { email: updates.email }),
          },
        });
      }

      let profileUpdate;
      switch (userRole) {
        case "TEACHER":
          if (updates.phone || updates.experienceYears) {
            profileUpdate = await prisma.teacherProfile.update({
              where: {
                userId,
              },
              data: {
                ...(updates.phone && { phone: updates.phone }),
                ...(updates.experienceYears && {
                  experienceYears: updates.experienceYears,
                }),
              },
            });
          }
          break;
        case "PARENT":
          if (updates.phone) {
            profileUpdate = await prisma.parentProfile.update({
              where: { userId },
              data: { phone: updates.phone },
            });
          }
          break;
      }
      res
        .status(200)
        .json(
          new ApiResponse(200, profileUpdate, "Profile updated successfully")
        );
    } catch (error) {
      next(error);
    }
  }
);

export const addChildToParentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentUserId = req.params.id; // Parent's user ID
      const { childUserId } = req.body; // Student's user ID

      const parentUser = await prisma.parentProfile.findUnique({
        where: { id: parentUserId },
      });

      if (!parentUser) {
        throw new CustomError("Invalid parent ID", 400);
      }

      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: childUserId },
      });

      if (!studentProfile) {
        throw new CustomError("Student profile not found", 404);
      }

      const updatedStudentProfile = await prisma.studentProfile.update({
        where: { userId: childUserId },
        data: { parentId: parentUser.id },
      });

      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            updatedStudentProfile,
            "Child added to parent successfully"
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

export const getAllStudentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
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
              parentProfile: {
                select: {
                  phone: true,
                },
              },
            },
          },
        },
      });

      if (!students || students.length === 0) {
        throw new CustomError("No students found", 404);
      }

      res
        .status(200)
        .json(new ApiResponse(200, students, "Students fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const getAllParentsController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parents = await prisma.parentProfile.findMany({
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
      res
        .status(200)
        .json(new ApiResponse(200, parents, "Parents fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const getAllTeachersController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teachers = await prisma.teacherProfile.findMany({
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
      if (!teachers || teachers.length === 0) {
        throw new CustomError("No teachers found", 404);
      }
      res
        .status(200)
        .json(new ApiResponse(200, teachers, "Teachers fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const getParentChildrenController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentId = req.params.id || (req as any).user?.id;

      const children = await prisma.studentProfile.findMany({
        where: { parentId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
            },
          },
        },
      });

      res
        .status(200)
        .json(new ApiResponse(200, children, "Children fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const searchStudentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: fix here
      const searchTerm = req.params.search || (req.query.name as string);

      if (!searchTerm) {
        throw new CustomError("Search term is required", 400);
      }

      const students = await prisma.studentProfile.findMany({
        where: {
          user: {
            OR: [
              {
                name: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            ],
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

      res
        .status(200)
        .json(new ApiResponse(200, students, "Students fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);
export const searchParentController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: fix here
      const searchTerm = req.params.name || (req.query.name as string);

      if (!searchTerm) {
        throw new CustomError("Search term is required", 400);
      }

      const parents = await prisma.parentProfile.findMany({
        where: {
          user: {
            OR: [
              {
                name: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            ],
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

      res
        .status(200)
        .json(new ApiResponse(200, parents, "Parents fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

export const searchTeacherController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchTerm = req.params.name || (req.query.name as string);
      if (!searchTerm) {
        throw new CustomError("Search term is required", 400);
      }

      const teachers = await prisma.teacherProfile.findMany({
        where: {
          user: {
            OR: [
              {
                name: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            ],
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
      if (!teachers || teachers.length === 0) {
        throw new CustomError("No teachers found", 404);
      }

      res
        .status(200)
        .json(new ApiResponse(200, teachers, "Teachers fetched successfully"));
    } catch (error) {
      next(error);
    }
  }
);

// user with profile
export const getUserProfileController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: userRole === "STUDENT",
          parentProfile: userRole === "PARENT",
          teacherProfile: userRole === "TEACHER",
        },
      });

      if (!user) {
        throw new CustomError("User not found", 404);
      }

      const profile =
        user.role === "STUDENT"
          ? user.studentProfile
          : user.role === "PARENT"
          ? user.parentProfile
          : user.role === "TEACHER"
          ? user.teacherProfile
          : null;

      res.status(200).json(
        new ApiResponse(
          200,
          {
            ...user,
            profile,
          },
          "Profile fetched successfully"
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export const verifyAdminController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query.id || null;

      if (!userId) {
        throw new CustomError("User ID is required", 400);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user || user.role !== "ADMIN") {
        throw new CustomError("Unauthorized access", 403);
      }
      await prisma.teacherProfile.update({
        where: { userId: user.id },
        data: { isVerified: true },
      });

      res
        .status(200)
        .json(new ApiResponse(200, user, "Admin verified successfully"));
    } catch (error) {
      next(error);
    }
  }
);

// controller for teacher and student

// get exact serch for user
export const getExactSearchForUserController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.query.email as string;

      if (!search) {
        throw new CustomError("Search term is required", 400);
      }
      const user = await prisma.studentProfile.findFirst({
        where: {
          user: {
            email: {
              contains: email,
              mode: "insensitive",
            },
          },
        },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// get exact search for teacher
export const getExactSearchForTeacherController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.query.email as string;

      if (!search) {
        throw new CustomError("Search term is required", 400);
      }
      const user = await prisma.teacherProfile.findFirst({
        where: {
          user: {
            email: {
              contains: email,
              mode: "insensitive",
            },
          },
        },
        select: {
          id: true,
          experienceYears: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
