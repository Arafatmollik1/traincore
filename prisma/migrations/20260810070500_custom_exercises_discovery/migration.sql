-- CreateEnum
CREATE TYPE "Joint" AS ENUM ('ELBOW', 'KNEE', 'HIP', 'SHOULDER');

-- DropIndex
DROP INDEX "Challenge_createdAt_idx";

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "customExerciseId" TEXT,
ADD COLUMN     "featuredAt" TIMESTAMP(3),
ALTER COLUMN "exercise" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CustomExercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎯',
    "joint" "Joint" NOT NULL,
    "downAngle" INTEGER NOT NULL,
    "upAngle" INTEGER NOT NULL,
    "minCycleMs" INTEGER NOT NULL DEFAULT 400,
    "maxRpm" INTEGER NOT NULL DEFAULT 60,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomExercise_createdById_idx" ON "CustomExercise"("createdById");

-- CreateIndex
CREATE INDEX "Challenge_archivedAt_createdAt_idx" ON "Challenge"("archivedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Challenge_featuredAt_idx" ON "Challenge"("featuredAt" DESC);

-- AddForeignKey
ALTER TABLE "CustomExercise" ADD CONSTRAINT "CustomExercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_customExerciseId_fkey" FOREIGN KEY ("customExerciseId") REFERENCES "CustomExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

