-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('PUBLIC', 'PRIVATE', 'PROTECTED');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "accessType" "AccessType" NOT NULL DEFAULT 'PUBLIC';
