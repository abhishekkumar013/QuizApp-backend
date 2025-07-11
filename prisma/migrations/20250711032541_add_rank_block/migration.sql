-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "Block" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ParentProfile" ADD COLUMN     "Block" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "Block" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "Rank" INTEGER NOT NULL DEFAULT -1,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "Block" BOOLEAN NOT NULL DEFAULT false;
