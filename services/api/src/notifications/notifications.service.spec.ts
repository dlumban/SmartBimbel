import { Queue } from "bullmq";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";

describe("NotificationsService.send", () => {
  let prisma: { notification: { create: jest.Mock } };
  let queue: { add: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = { notification: { create: jest.fn() } };
    queue = { add: jest.fn() };
    service = new NotificationsService(prisma as unknown as PrismaService, queue as unknown as Queue);
  });

  it("persists the notification and enqueues delivery across the default channels", async () => {
    prisma.notification.create.mockResolvedValue({ id: "n1", userId: "u1", type: "BOOKING_ACCEPTED" });

    const result = await service.send("u1", "BOOKING_ACCEPTED", { bookingId: "b1" });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", type: "BOOKING_ACCEPTED", data: { bookingId: "b1" } },
    });
    expect(queue.add).toHaveBeenCalledWith("deliver-notification", {
      notificationId: "n1",
      channels: ["PUSH", "EMAIL", "WHATSAPP"],
    });
    expect(result).toEqual({ id: "n1", userId: "u1", type: "BOOKING_ACCEPTED" });
  });

  it("writes through the given transaction client instead of the default prisma instance", async () => {
    const tx = { notification: { create: jest.fn().mockResolvedValue({ id: "n2" }) } };

    await service.send("u1", "BOOKING_CANCELLED", { bookingId: "b2" }, tx as never);

    expect(tx.notification.create).toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith("deliver-notification", {
      notificationId: "n2",
      channels: ["PUSH", "EMAIL", "WHATSAPP"],
    });
  });

  it("respects an explicit channel list override", async () => {
    prisma.notification.create.mockResolvedValue({ id: "n3" });

    await service.send("u1", "BOOKING_REMINDER_1H", { bookingId: "b3" }, undefined, ["EMAIL"]);

    expect(queue.add).toHaveBeenCalledWith("deliver-notification", {
      notificationId: "n3",
      channels: ["EMAIL"],
    });
  });

  it("persists a SESSION_EDITED notification the same way as any other type", async () => {
    prisma.notification.create.mockResolvedValue({ id: "n4", userId: "u1", type: "SESSION_EDITED" });

    const result = await service.send("u1", "SESSION_EDITED", { bookingId: "b4" });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", type: "SESSION_EDITED", data: { bookingId: "b4" } },
    });
    expect(queue.add).toHaveBeenCalledWith("deliver-notification", {
      notificationId: "n4",
      channels: ["PUSH", "EMAIL", "WHATSAPP"],
    });
    expect(result).toEqual({ id: "n4", userId: "u1", type: "SESSION_EDITED" });
  });
});
