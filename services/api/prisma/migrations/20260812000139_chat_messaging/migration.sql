-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_RECEIVED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "meetingAddress" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "meetingSetAt" TIMESTAMP(3),
ADD COLUMN     "meetingSetByUserId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "streamChannelId" TEXT;

-- CreateTable
CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationBlock" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "blockedByUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageReport_conversationId_idx" ON "MessageReport"("conversationId");

-- CreateIndex
CREATE INDEX "MessageReport_reportedUserId_idx" ON "MessageReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "ConversationBlock_conversationId_idx" ON "ConversationBlock"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationBlock_conversationId_blockedByUserId_key" ON "ConversationBlock"("conversationId", "blockedByUserId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_meetingSetByUserId_fkey" FOREIGN KEY ("meetingSetByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationBlock" ADD CONSTRAINT "ConversationBlock_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationBlock" ADD CONSTRAINT "ConversationBlock_blockedByUserId_fkey" FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationBlock" ADD CONSTRAINT "ConversationBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
