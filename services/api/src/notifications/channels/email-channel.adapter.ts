import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NOTIFICATION_TEMPLATES } from "../templates";
import { ChannelDeliveryPayload, NotificationChannelAdapter } from "./notification-channel.interface";

/**
 * Email delivery via SendGrid (PRD §6.1.C fallback channel). No SendGrid
 * API key is provisioned in this environment (docs/third-party-setup.md) -
 * falls back to logging rather than throwing, since "not configured" is a
 * permanent condition BullMQ's retry/backoff can never resolve.
 */
@Injectable()
export class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "EMAIL" as const;
  private readonly logger = new Logger(EmailChannelAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send({ user, type }: ChannelDeliveryPayload): Promise<void> {
    if (!user.email) {
      this.logger.debug(`User ${user.id} has no email on file - skipping email "${type}".`);
      return;
    }

    const apiKey = this.config.get<string>("SENDGRID_API_KEY");
    if (!apiKey) {
      this.logger.debug(`SendGrid is not configured - skipping email "${type}" to ${user.email}.`);
      return;
    }

    const template = NOTIFICATION_TEMPLATES[type];
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: user.email }] }],
        from: { email: "notifications@smartbimbel.id" },
        subject: template.subject,
        content: [{ type: "text/plain", value: template.body }],
      }),
    });

    if (!res.ok) {
      throw new Error(`SendGrid email delivery failed with status ${res.status}`);
    }
  }
}
