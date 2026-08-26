import { Job } from "bullmq";
import { User } from "@prisma/client";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";
import { PrismaService } from "../../prisma/prisma.service";
import { PushChannelAdapter } from "../channels/push-channel.adapter";
import { EmailChannelAdapter } from "../channels/email-channel.adapter";
import { WhatsAppChannelAdapter } from "../channels/whatsapp-channel.adapter";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    role: "STUDENT",
    phone: "+6281234567890",
    email: "u1@example.com",
    name: "Andi",
    firebaseUid: "fb-1",
    status: "ACTIVE",
    whatsappOptOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function makeJob(data: { notificationId: string; channels: ("PUSH" | "EMAIL" | "WHATSAPP")[] }) {
  return { data } as Job<typeof data>;
}

describe("NotificationDeliveryProcessor", () => {
  let prisma: { notification: { findUnique: jest.Mock } };
  let push: { send: jest.Mock };
  let email: { send: jest.Mock };
  let whatsapp: { send: jest.Mock };
  let processor: NotificationDeliveryProcessor;

  beforeEach(() => {
    prisma = { notification: { findUnique: jest.fn() } };
    push = { send: jest.fn().mockResolvedValue(undefined) };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    whatsapp = { send: jest.fn().mockResolvedValue(undefined) };
    processor = new NotificationDeliveryProcessor(
      prisma as unknown as PrismaService,
      push as unknown as PushChannelAdapter,
      email as unknown as EmailChannelAdapter,
      whatsapp as unknown as WhatsAppChannelAdapter,
    );
  });

  it("does nothing if the notification no longer exists", async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await processor.process(makeJob({ notificationId: "n1", channels: ["PUSH"] }));
    expect(push.send).not.toHaveBeenCalled();
  });

  it("dispatches to every requested channel", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "n1",
      type: "BOOKING_ACCEPTED",
      data: { bookingId: "b1" },
      user: makeUser(),
    });

    await processor.process(
      makeJob({ notificationId: "n1", channels: ["PUSH", "EMAIL", "WHATSAPP"] }),
    );

    expect(push.send).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
  });

  it("skips WhatsApp for a user who has opted out, but still delivers other channels", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "n1",
      type: "BOOKING_ACCEPTED",
      data: {},
      user: makeUser({ whatsappOptOut: true }),
    });

    await processor.process(
      makeJob({ notificationId: "n1", channels: ["PUSH", "EMAIL", "WHATSAPP"] }),
    );

    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(push.send).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("throws (for BullMQ to retry) when any channel fails", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "n1",
      type: "BOOKING_ACCEPTED",
      data: {},
      user: makeUser(),
    });
    email.send.mockRejectedValue(new Error("SendGrid down"));

    await expect(
      processor.process(makeJob({ notificationId: "n1", channels: ["PUSH", "EMAIL"] })),
    ).rejects.toThrow(/SendGrid down/);
  });
});
