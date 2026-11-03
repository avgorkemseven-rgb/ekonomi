-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "graceReplayCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "replacedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_replacedById_key" ON "Session"("replacedById");
