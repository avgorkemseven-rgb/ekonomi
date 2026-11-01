-- AlterTable
ALTER TABLE "ListingImage" ADD COLUMN     "thumbStorageKey" TEXT NOT NULL,
ADD COLUMN     "thumbUrl" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ListingImage_thumbStorageKey_key" ON "ListingImage"("thumbStorageKey");
