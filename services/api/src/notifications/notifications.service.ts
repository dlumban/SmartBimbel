import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATION_DELIVERY_QUEUE } from "../jobs/jobs.module";
import { NotificationChannel } from "./channels/notification-channel.interface";

const DEFAULT_CHANNELS: NotificationChannel[] = ["PUSH", "EMAIL", "WHATSAPP"];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE) private readonly deliveryQueue: Queue,
  ) {}

  // Persists the in-app notification record (the durable "this happened"
  // fact - Task 3.3) and enqueues async, retryable delivery across
  // push/email/WhatsApp (Task 3.6). Booking code calls this, not a channel
  // SDK directly - delivery failures are handled entirely by the queue and
  // never propagate back to fail the booking API call that triggered them.
  async send(
    userId: string,
    type: NotificationType,
    data: Prisma.InputJsonValue,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    channels: NotificationChannel[] = DEFAULT_CHANNELS,
  ) {
    const notification = await client.notification.create({ data: { userId, type, data } });
    await this.deliveryQueue.add("deliver-notification", {
      notificationId: notification.id,
      channels,
    });
    return notification;
  }
}
