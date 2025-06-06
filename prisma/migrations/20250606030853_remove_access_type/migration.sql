/*
  Warnings:

  - You are about to drop the column `accessType` on the `Quiz` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Quiz" DROP COLUMN "accessType";

-- DropEnum
DROP TYPE "AccessType";
