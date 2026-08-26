import { NotificationType, User } from "@prisma/client";

export type NotificationChannel = "PUSH" | "EMAIL" | "WHATSAPP";

export interface ChannelDeliveryPayload {
  user: User;
  type: NotificationType;
  data: unknown;
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  send(payload: ChannelDeliveryPayload): Promise<void>;
}
