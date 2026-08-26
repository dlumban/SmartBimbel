-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "streamMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_streamMessageId_key" ON "Message"("streamMessageId");
