-- Rebuild custom exercises as pose templates (seed-only data, safe to clear)
DELETE FROM "Challenge" WHERE "customExerciseId" IS NOT NULL;
DELETE FROM "CustomExercise";

-- AlterTable
ALTER TABLE "CustomExercise" DROP COLUMN "joint",
DROP COLUMN "downAngle",
DROP COLUMN "upAngle",
ADD COLUMN "poses" JSONB NOT NULL,
ALTER COLUMN "minCycleMs" SET DEFAULT 600;

-- DropEnum
DROP TYPE "Joint";
