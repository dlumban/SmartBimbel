import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NOTIFICATION_TEMPLATES } from "../templates";
import { ChannelDeliveryPayload, NotificationChannelAdapter } from "./notification-channel.interface";

/**
 * WhatsApp delivery via the Business Solution Provider selected in Sprint 0
 * Task 0.6. No BSP account is provisioned in this environment
 * (docs/third-party-setup.md) - falls back to logging rather than
 * throwing, since "not configured" is permanent and BullMQ's retry/backoff
 * can never resolve it. Swap WHATSAPP_BSP_API_URL/WHATSAPP_BSP_API_KEY in
 * before Sprint 8 once the BSP contract is finalized.
 */
@Injectable()
export class WhatsAppChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "WHATSAPP" as const;
  private readonly logger = new Logger(WhatsAppChannelAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send({ user, type }: ChannelDeliveryPayload): Promise<void> {
    if (!user.phone) {
      this.logger.debug(`User ${user.id} has no phone on file - skipping WhatsApp "${type}".`);
      return;
    }

    const apiUrl = this.config.get<string>("WHATSAPP_BSP_API_URL");
    const apiKey = this.config.get<string>("WHATSAPP_BSP_API_KEY");
    if (!apiUrl || !apiKey) {
      this.logger.debug(`WhatsApp BSP is not configured - skipping "${type}" to ${user.phone}.`);
      return;
    }

    const template = NOTIFICATION_TEMPLATES[type];
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: user.phone, text: `${template.subject}\n${template.body}` }),
    });

    if (!res.ok) {
      throw new Error(`WhatsApp delivery failed with status ${res.status}`);
    }
  }
}
