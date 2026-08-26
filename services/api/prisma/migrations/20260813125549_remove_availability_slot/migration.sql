-- DropForeignKey
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_tutorId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_availabilitySlotId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "availabilitySlotId";

-- DropTable
DROP TABLE "AvailabilitySlot";
