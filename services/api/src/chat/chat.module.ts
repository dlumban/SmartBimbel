import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatController } from "./chat.controller";
import { ChatWebhookController } from "./chat-webhook.controller";
import { ChatService } from "./chat.service";
import { StreamChatService } from "./stream-chat.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ChatController, ChatWebhookController],
  providers: [ChatService, StreamChatService],
  exports: [ChatService, StreamChatService],
})
export class ChatModule {}
