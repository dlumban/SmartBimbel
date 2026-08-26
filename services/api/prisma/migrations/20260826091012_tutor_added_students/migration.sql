-- AlterTable
ALTER TABLE "User" ADD COLUMN     "addedByTutorId" TEXT;

-- CreateIndex
CREATE INDEX "User_addedByTutorId_idx" ON "User"("addedByTutorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_addedByTutorId_fkey" FOREIGN KEY ("addedByTutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
