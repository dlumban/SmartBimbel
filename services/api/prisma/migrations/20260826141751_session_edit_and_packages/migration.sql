-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_EDITED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "packageId" TEXT;

-- CreateTable
CREATE TABLE "TutoringPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringPackage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TutoringPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
