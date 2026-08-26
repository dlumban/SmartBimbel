import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NOTIFICATION_DELIVERY_QUEUE } from "../../jobs/jobs.module";
import { NotificationChannel, NotificationChannelAdapter } from "../channels/notification-channel.interface";
import { PushChannelAdapter } from "../channels/push-channel.adapter";
import { EmailChannelAdapter } from "../channels/email-channel.adapter";
import { WhatsAppChannelAdapter } from "../channels/whatsapp-channel.adapter";

interface DeliveryJobData {
  notificationId: string;
  channels: NotificationChannel[];
}

@Processor(NOTIFICATION_DELIVERY_QUEUE)
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);
  private readonly adapters: Record<NotificationChannel, NotificationChannelAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    push: PushChannelAdapter,
    email: EmailChannelAdapter,
    whatsapp: WhatsAppChannelAdapter,
  ) {
    super();
    this.adapters = { PUSH: push, EMAIL: email, WHATSAPP: whatsapp };
  }

  async process(job: Job<DeliveryJobData>): Promise<void> {
    const { notificationId, channels } = job.data;
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: true },
    });
    if (!notification) {
      this.logger.warn(`Notification ${notificationId} no longer exists - nothing to deliver.`);
      return;
    }

    // WhatsApp is the one channel with an MVP opt-out (Task 3.6) - filtered
    // here rather than at enqueue time so a preference change between
    // enqueue and delivery is always respected.
    const targetChannels = channels.filter(
      (channel) => channel !== "WHATSAPP" || !notification.user.whatsappOptOut,
    );

    const results = await Promise.allSettled(
      targetChannels.map((channel) =>
        this.adapters[channel].send({
          user: notification.user,
          type: notification.type,
          data: notification.data,
        }),
      ),
    );

    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failures.length > 0) {
      // Failing the whole job lets BullMQ's configured retry/backoff
      // (JobsModule) re-attempt it - channels that already succeeded may
      // be re-sent on retry, an accepted MVP simplification over
      // per-channel sub-jobs.
      throw new Error(
        `${failures.length}/${targetChannels.length} channel(s) failed: ${failures
          .map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)))
          .join("; ")}`,
      );
    }
  }
}
