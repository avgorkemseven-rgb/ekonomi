-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "contentReviewedAt" TIMESTAMP(3);

-- Backfill: listings that already went live were last reviewed when published (or approved by a moderator).
UPDATE "Listing"
SET "contentReviewedAt" = COALESCE("moderatedAt", "publishedAt")
WHERE "publishedAt" IS NOT NULL;
