-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "diplomaDocumentPath" TEXT,
ADD COLUMN     "ktpDocumentPath" TEXT,
ADD COLUMN     "profileSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;
