-- CreateEnum
CREATE TYPE "ExerciseKind" AS ENUM ('REPS', 'HOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExerciseType" ADD VALUE 'PLANK';
ALTER TYPE "ExerciseType" ADD VALUE 'WALL_SIT';

-- AlterTable
ALTER TABLE "ChallengeSegment" ADD COLUMN     "holdSeconds" INTEGER,
ALTER COLUMN "targetReps" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomExercise" ADD COLUMN     "kind" "ExerciseKind" NOT NULL DEFAULT 'REPS';
