import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";

export const BOOKING_EXPIRY_QUEUE = "booking-expiry";
export const NOTIFICATION_DELIVERY_QUEUE = "notification-delivery";
export const SESSION_REMINDER_QUEUE = "session-reminder";
export const PAYMENT_EXPIRY_QUEUE = "payment-expiry";
export const SESSION_AUTO_COMPLETE_QUEUE = "session-auto-complete";

/**
 * BullMQ (Redis-backed job queue) for anything that needs to run later or
 * be retried on failure - booking auto-expiry (Task 3.2) is the first
 * consumer; Task 3.6 (notifications) reuses this same infrastructure
 * rather than each feature inventing its own async job handling.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>("REDIS_URL") ?? "redis://localhost:6379");
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: BOOKING_EXPIRY_QUEUE },
      // Channel delivery is retried on failure (up to 3 attempts, backing
      // off) - an unreachable WhatsApp/email/push provider must never fail
      // the booking API call that triggered the notification.
      {
        name: NOTIFICATION_DELIVERY_QUEUE,
        defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      },
      { name: SESSION_REMINDER_QUEUE },
      { name: PAYMENT_EXPIRY_QUEUE },
      { name: SESSION_AUTO_COMPLETE_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class JobsModule {}
