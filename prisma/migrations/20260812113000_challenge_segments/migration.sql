-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_customExerciseId_fkey";

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "customExerciseId",
DROP COLUMN "exercise",
DROP COLUMN "targetReps",
DROP COLUMN "timeLimitSeconds";

-- CreateTable
CREATE TABLE "ChallengeSegment" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exercise" "ExerciseType",
    "customExerciseId" TEXT,
    "targetReps" INTEGER NOT NULL,
    "timeLimitSeconds" INTEGER NOT NULL,
    "restAfterSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChallengeSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeSegment_customExerciseId_idx" ON "ChallengeSegment"("customExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeSegment_challengeId_order_key" ON "ChallengeSegment"("challengeId", "order");

-- AddForeignKey
ALTER TABLE "ChallengeSegment" ADD CONSTRAINT "ChallengeSegment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSegment" ADD CONSTRAINT "ChallengeSegment_customExerciseId_fkey" FOREIGN KEY ("customExerciseId") REFERENCES "CustomExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

