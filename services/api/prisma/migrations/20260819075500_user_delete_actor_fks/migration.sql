-- Actor FKs that point at User must SET NULL (or the report's message
-- pointer) so deleting an account is not blocked by Restrict while owned
-- bookings/messages are still cascading.

-- AlterTable
ALTER TABLE "Dispute" ALTER COLUMN "raisedByUserId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_requestedByUserId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_rescheduleProposedByUserId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_cancelledByUserId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_noShowReportedByUserId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_meetingSetByUserId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_completedByUserId_fkey";
ALTER TABLE "BookingStatusHistory" DROP CONSTRAINT IF EXISTS "BookingStatusHistory_changedByUserId_fkey";
ALTER TABLE "MessageReport" DROP CONSTRAINT IF EXISTS "MessageReport_messageId_fkey";
ALTER TABLE "Payout" DROP CONSTRAINT IF EXISTS "Payout_processedByUserId_fkey";
ALTER TABLE "Dispute" DROP CONSTRAINT IF EXISTS "Dispute_raisedByUserId_fkey";
ALTER TABLE "Dispute" DROP CONSTRAINT IF EXISTS "Dispute_resolvedByUserId_fkey";

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rescheduleProposedByUserId_fkey" FOREIGN KEY ("rescheduleProposedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_noShowReportedByUserId_fkey" FOREIGN KEY ("noShowReportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_meetingSetByUserId_fkey" FOREIGN KEY ("meetingSetByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
