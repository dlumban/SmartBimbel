-- CreateEnum
CREATE TYPE "CancellationReasonCode" AS ENUM ('SCHEDULE_CONFLICT', 'ILLNESS', 'FOUND_ALTERNATIVE', 'NO_LONGER_NEEDED', 'OTHER');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'RESCHEDULE_PROPOSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_RESCHEDULE_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_RESCHEDULE_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_RESCHEDULE_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_NO_SHOW_REPORTED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReasonCode" "CancellationReasonCode",
ADD COLUMN     "isLateCancellation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noShowReportedAt" TIMESTAMP(3),
ADD COLUMN     "noShowReportedByUserId" TEXT,
ADD COLUMN     "rescheduleProposedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rescheduleProposedByUserId_fkey" FOREIGN KEY ("rescheduleProposedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_noShowReportedByUserId_fkey" FOREIGN KEY ("noShowReportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
