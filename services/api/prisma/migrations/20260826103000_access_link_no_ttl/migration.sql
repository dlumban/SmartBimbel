-- AlterTable
ALTER TABLE "AccessLink" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AccessLink" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
