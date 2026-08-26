import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { User } from "@prisma/client";
import { ChatService } from "./chat.service";
import { PrismaService } from "../prisma/prisma.service";
import { StreamChatService } from "./stream-chat.service";
import { NotificationsService } from "../notifications/notifications.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    role: "STUDENT",
    phone: null,
    email: null,
    name: null,
    firebaseUid: "fb-1",
    status: "ACTIVE",
    whatsappOptOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

const studentUser = makeUser({ id: "student-1", role: "STUDENT" });
const strangerUser = makeUser({ id: "stranger-1", role: "STUDENT" });

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    student: { userId: "student-1" },
    tutor: { userId: "tutor-1" },
    conversation: { id: "conv-1", streamChannelId: null },
    ...overrides,
  };
}

describe("ChatService", () => {
  let prisma: {
    booking: { findUnique: jest.Mock };
    message: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock; findUnique: jest.Mock };
    messageReport: { create: jest.Mock };
    conversationBlock: { findFirst: jest.Mock; upsert: jest.Mock };
    conversation: { findFirst: jest.Mock; update: jest.Mock };
  };
  let streamChat: {
    generateUserToken: jest.Mock;
    getPublicApiKey: jest.Mock;
    createChannel: jest.Mock;
    sendMessage: jest.Mock;
  };
  let notifications: { send: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      message: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
      messageReport: { create: jest.fn() },
      conversationBlock: { findFirst: jest.fn(), upsert: jest.fn() },
      conversation: { findFirst: jest.fn(), update: jest.fn() },
    };
    streamChat = {
      generateUserToken: jest.fn().mockReturnValue("fake-token"),
      getPublicApiKey: jest.fn().mockReturnValue("fake-key"),
      createChannel: jest.fn().mockResolvedValue("messaging:c1"),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    service = new ChatService(
      prisma as unknown as PrismaService,
      streamChat as unknown as StreamChatService,
      notifications as unknown as NotificationsService,
    );
  });

  describe("getToken", () => {
    it("returns a token and channel id for a participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      const result = await service.getToken(studentUser, "b1");
      expect(result).toEqual({ token: "fake-token", apiKey: "fake-key", channelId: null });
      expect(streamChat.generateUserToken).toHaveBeenCalledWith("student-1");
    });

    it("rejects a non-participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(service.getToken(strangerUser, "b1")).rejects.toThrow(ForbiddenException);
      expect(streamChat.generateUserToken).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a nonexistent booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.getToken(studentUser, "b1")).rejects.toThrow(NotFoundException);
    });

    it("propagates a 503 when Stream isn't configured", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      streamChat.generateUserToken.mockImplementation(() => {
        throw new ServiceUnavailableException("Chat is not configured on this server yet.");
      });
      await expect(service.getToken(studentUser, "b1")).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe("sendMessage", () => {
    it("creates a message, notifies the other participant, and mirrors to Stream when a channel exists", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ conversation: { id: "conv-1", streamChannelId: "messaging:c1" } }),
      );
      prisma.conversationBlock.findFirst.mockResolvedValue(null);
      prisma.message.create.mockResolvedValue({ id: "m1", body: "hi", senderId: "student-1" });

      const result = await service.sendMessage(studentUser, "b1", { body: "hi" });

      expect(result.id).toBe("m1");
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: "conv-1", senderId: "student-1", body: "hi" },
        include: { sender: { select: { id: true, name: true } } },
      });
      expect(notifications.send).toHaveBeenCalledWith("tutor-1", "MESSAGE_RECEIVED", {
        bookingId: "b1",
        messageId: "m1",
      });
      expect(streamChat.sendMessage).toHaveBeenCalledWith("messaging:c1", "student-1", "hi");
    });

    it("still persists the message when Stream mirroring fails", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ conversation: { id: "conv-1", streamChannelId: "messaging:c1" } }),
      );
      prisma.conversationBlock.findFirst.mockResolvedValue(null);
      prisma.message.create.mockResolvedValue({ id: "m1" });
      streamChat.sendMessage.mockRejectedValue(new Error("Stream unreachable"));

      await expect(service.sendMessage(studentUser, "b1", { body: "hi" })).resolves.toEqual({
        id: "m1",
      });
    });

    it("rejects a message from a user the other participant has blocked", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.conversationBlock.findFirst.mockResolvedValue({ id: "block1" });

      await expect(service.sendMessage(studentUser, "b1", { body: "hi" })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it("rejects a non-participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(service.sendMessage(strangerUser, "b1", { body: "hi" })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("reportMessage", () => {
    it("creates a report referencing the message's sender", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.message.findUnique.mockResolvedValue({
        id: "m1",
        conversationId: "conv-1",
        senderId: "tutor-1",
      });
      prisma.messageReport.create.mockResolvedValue({ id: "r1" });

      await service.reportMessage(studentUser, "b1", "m1", { reason: "Kasar" });

      expect(prisma.messageReport.create).toHaveBeenCalledWith({
        data: {
          conversationId: "conv-1",
          messageId: "m1",
          reporterId: "student-1",
          reportedUserId: "tutor-1",
          reason: "Kasar",
        },
      });
    });

    it("rejects reporting your own message", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.message.findUnique.mockResolvedValue({
        id: "m1",
        conversationId: "conv-1",
        senderId: "student-1",
      });

      await expect(
        service.reportMessage(studentUser, "b1", "m1", { reason: "test" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException for a message in a different conversation", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.message.findUnique.mockResolvedValue({
        id: "m1",
        conversationId: "some-other-conv",
        senderId: "tutor-1",
      });

      await expect(
        service.reportMessage(studentUser, "b1", "m1", { reason: "test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("reportUser", () => {
    it("reports the other participant with no messageId", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.messageReport.create.mockResolvedValue({ id: "r1" });

      await service.reportUser(studentUser, "b1", { reason: "Perilaku tidak pantas" });

      expect(prisma.messageReport.create).toHaveBeenCalledWith({
        data: {
          conversationId: "conv-1",
          reporterId: "student-1",
          reportedUserId: "tutor-1",
          reason: "Perilaku tidak pantas",
        },
      });
    });
  });

  describe("blockUser", () => {
    it("upserts a block record targeting the other participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.conversationBlock.upsert.mockResolvedValue({ id: "block1" });

      await service.blockUser(studentUser, "b1");

      expect(prisma.conversationBlock.upsert).toHaveBeenCalledWith({
        where: {
          conversationId_blockedByUserId: { conversationId: "conv-1", blockedByUserId: "student-1" },
        },
        update: {},
        create: { conversationId: "conv-1", blockedByUserId: "student-1", blockedUserId: "tutor-1" },
      });
    });
  });

  describe("createChannelForBooking", () => {
    it("creates the Stream channel and stores its id on the conversation", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());

      await service.createChannelForBooking("b1");

      expect(streamChat.createChannel).toHaveBeenCalledWith("booking-b1", ["student-1", "tutor-1"]);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: "conv-1" },
        data: { streamChannelId: "messaging:c1" },
      });
    });

    it("never throws when Stream isn't configured - it's best-effort", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      streamChat.createChannel.mockRejectedValue(
        new ServiceUnavailableException("Chat is not configured on this server yet."),
      );

      await expect(service.createChannelForBooking("b1")).resolves.toBeUndefined();
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe("handleStreamMessageEvent", () => {
    it("mirrors a message.new event into our own Message table and notifies the recipient", async () => {
      prisma.message.findUnique.mockResolvedValue(null);
      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        booking: { id: "b1", student: { userId: "student-1" }, tutor: { userId: "tutor-1" } },
      });
      prisma.message.create.mockResolvedValue({ id: "m1" });

      await service.handleStreamMessageEvent({
        type: "message.new",
        message: { id: "stream-msg-1", text: "hi", user: { id: "student-1" } },
        cid: "messaging:c1",
      });

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: "conv-1",
          senderId: "student-1",
          body: "hi",
          streamMessageId: "stream-msg-1",
        },
      });
      expect(notifications.send).toHaveBeenCalledWith("tutor-1", "MESSAGE_RECEIVED", {
        bookingId: "b1",
        messageId: "m1",
      });
    });

    it("is idempotent for a retried webhook delivery", async () => {
      prisma.message.findUnique.mockResolvedValue({ id: "already-mirrored" });

      await service.handleStreamMessageEvent({
        type: "message.new",
        message: { id: "stream-msg-1", text: "hi", user: { id: "student-1" } },
        cid: "messaging:c1",
      });

      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it("ignores non-message.new event types", async () => {
      await service.handleStreamMessageEvent({ type: "user.updated" });
      expect(prisma.message.findUnique).not.toHaveBeenCalled();
    });
  });
});
