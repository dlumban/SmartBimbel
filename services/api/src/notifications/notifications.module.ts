import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsService } from "./notifications.service";
import { NotificationDeliveryProcessor } from "./processors/notification-delivery.processor";
import { PushChannelAdapter } from "./channels/push-channel.adapter";
import { EmailChannelAdapter } from "./channels/email-channel.adapter";
import { WhatsAppChannelAdapter } from "./channels/whatsapp-channel.adapter";

@Module({
  imports: [JobsModule],
  providers: [
    NotificationsService,
    NotificationDeliveryProcessor,
    PushChannelAdapter,
    EmailChannelAdapter,
    WhatsAppChannelAdapter,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
