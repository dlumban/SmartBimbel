-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'REVIEWED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingAttachmentKind" ADD VALUE 'HOMEWORK';
ALTER TYPE "BookingAttachmentKind" ADD VALUE 'HOMEWORK_SUBMISSION';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "dailyRoomName" TEXT,
ADD COLUMN     "dailyRoomUrl" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "whiteboardSnapshot" JSONB;

-- AlterTable
ALTER TABLE "BookingAttachment" ADD COLUMN     "homeworkAssignmentId" TEXT,
ADD COLUMN     "homeworkSubmissionId" TEXT;

-- CreateTable
CREATE TABLE "BookingGroup" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "mode" "TeachingMode" NOT NULL,
    "packageId" TEXT,
    "notes" TEXT,
    "meetingLink" TEXT,
    "meetingAddress" TEXT,
    "meetingSetByUserId" TEXT,
    "meetingSetAt" TIMESTAMP(3),
    "dailyRoomName" TEXT,
    "dailyRoomUrl" TEXT,
    "whiteboardSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "topicsCovered" TEXT NOT NULL,
    "strengths" TEXT,
    "areasToImprove" TEXT,
    "nextGoals" TEXT,
    "overallScore" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "HomeworkStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tutorFeedback" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingGroup_tutorId_idx" ON "BookingGroup"("tutorId");

-- CreateIndex
CREATE INDEX "BookingGroup_scheduledAt_idx" ON "BookingGroup"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressReport_bookingId_key" ON "ProgressReport"("bookingId");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_bookingId_idx" ON "HomeworkAssignment"("bookingId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_assignmentId_studentId_key" ON "HomeworkSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");

-- CreateIndex
CREATE INDEX "BookingAttachment_homeworkAssignmentId_idx" ON "BookingAttachment"("homeworkAssignmentId");

-- CreateIndex
CREATE INDEX "BookingAttachment_homeworkSubmissionId_idx" ON "BookingAttachment"("homeworkSubmissionId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "TutorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TutoringPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAttachment" ADD CONSTRAINT "BookingAttachment_homeworkAssignmentId_fkey" FOREIGN KEY ("homeworkAssignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAttachment" ADD CONSTRAINT "BookingAttachment_homeworkSubmissionId_fkey" FOREIGN KEY ("homeworkSubmissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
