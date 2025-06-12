/*
  Warnings:

  - Added the required column `questionsAttempted` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionsCorrect` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionsIncorrect` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeTaken` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalScore` to the `Result` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "questionsAttempted" INTEGER NOT NULL,
ADD COLUMN     "questionsCorrect" INTEGER NOT NULL,
ADD COLUMN     "questionsIncorrect" INTEGER NOT NULL,
ADD COLUMN     "timeTaken" INTEGER NOT NULL,
ADD COLUMN     "totalScore" INTEGER NOT NULL;
