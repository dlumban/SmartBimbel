-- Soft-delete: tutors can remove a session from calendars without destroying
-- the row (history, payments, and disputes still reference it).
ALTER TABLE "Booking" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "deletedByUserId" TEXT;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Booking_deletedAt_idx" ON "Booking"("deletedAt");
