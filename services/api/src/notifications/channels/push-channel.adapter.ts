import { Injectable, Logger } from "@nestjs/common";
import { ChannelDeliveryPayload, NotificationChannelAdapter } from "./notification-channel.interface";

/**
 * FCM push delivery (PRD §6.1.C). No device-token registration flow exists
 * yet anywhere in the app (a browser/mobile push-permission prompt that
 * stores an FCM token per user is out of scope for Task 3.6) - there is
 * nowhere to send a push to regardless of FCM credentials, so this always
 * skips. It exists to establish the queue/worker/retry plumbing and the
 * channel interface a real implementation drops into once that
 * registration flow is built.
 */
@Injectable()
export class PushChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "PUSH" as const;
  private readonly logger = new Logger(PushChannelAdapter.name);

  async send({ user, type }: ChannelDeliveryPayload): Promise<void> {
    this.logger.debug(`No push token registered for user ${user.id} - skipping push "${type}".`);
  }
}
