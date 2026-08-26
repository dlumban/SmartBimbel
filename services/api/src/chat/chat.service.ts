import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { StreamChatService } from "./stream-chat.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { ReportDto } from "./dto/report.dto";
import { ListMessagesDto } from "./dto/list-messages.dto";

interface BookingParticipants {
  bookingId: string;
  conversationId: string;
  streamChannelId: string | null;
  studentUserId: string;
  tutorUserId: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streamChat: StreamChatService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getBookingParticipants(bookingId: string): Promise<BookingParticipants> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        student: { select: { userId: true } },
        tutor: { select: { userId: true } },
        conversation: { select: { id: true, streamChannelId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (!booking.conversation) {
      // Every booking gets a Conversation at creation time (Task 4.1) - a
      // missing one means a booking created before this migration, or a
      // genuine bug. Either way, there's nothing to chat in yet.
      throw new NotFoundException("No conversation exists for this booking yet.");
    }
    return {
      bookingId: booking.id,
      conversationId: booking.conversation.id,
      streamChannelId: booking.conversation.streamChannelId,
      studentUserId: booking.student.userId,
      tutorUserId: booking.tutor.userId,
    };
  }

  private assertParticipant(user: User, participants: BookingParticipants): void {
    if (user.id !== participants.studentUserId && user.id !== participants.tutorUserId) {
      throw new ForbiddenException("You are not a participant in this booking.");
    }
  }

  private otherParticipantUserId(user: User, participants: BookingParticipants): string {
    return user.id === participants.studentUserId
      ? participants.tutorUserId
      : participants.studentUserId;
  }

  async getToken(user: User, bookingId: string) {
    const participants = await this.getBookingParticipants(bookingId);
    this.assertParticipant(user, participants);

    // Lets the 503 (chat not configured) surface before doing anything
    // else - there's no point checking block status for a chat that
    // can't be reached anyway.
    const token = this.streamChat.generateUserToken(user.id);

    return {
      token,
      apiKey: this.streamChat.getPublicApiKey(),
      channelId: participants.streamChannelId,
    };
  }

  async listMessages(user: User, bookingId: string, query: ListMessagesDto) {
    const participants = await this.getBookingParticipants(bookingId);
    this.assertParticipant(user, participants);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: participants.conversationId },
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId: participants.conversationId } }),
    ]);

    return { data, total, page, limit };
  }

  async sendMessage(user: User, bookingId: string, dto: SendMessageDto) {
    const participants = await this.getBookingParticipants(bookingId);
    this.assertParticipant(user, participants);

    const blockedByOther = await this.prisma.conversationBlock.findFirst({
      where: { conversationId: participants.conversationId, blockedUserId: user.id },
    });
    if (blockedByOther) {
      throw new ForbiddenException("You have been blocked from this conversation.");
    }

    const message = await this.prisma.message.create({
      data: { conversationId: participants.conversationId, senderId: user.id, body: dto.body },
      include: { sender: { select: { id: true, name: true } } },
    });

    const recipientUserId = this.otherParticipantUserId(user, participants);
    await this.notifications.send(recipientUserId, "MESSAGE_RECEIVED", {
      bookingId,
      messageId: message.id,
    });

    if (participants.streamChannelId) {
      await this.streamChat
        .sendMessage(participants.streamChannelId, user.id, dto.body)
        .catch((err) =>
          this.logger.warn(`Failed to mirror message ${message.id} to Stream: ${err}`),
        );
    }

    return message;
  }

  async reportMessage(user: User, bookingId: string, messageId: string, dto: ReportDto) {
    const participants = await this.getBookingParticipants(bookingId);
    this.assertParticipant(user, participants);

    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.conversationId !== participants.conversationId) {
      throw new NotFoundException("No message with that id exists in this conversation.");
    }
    if (message.senderId === user.id) {
      throw new BadRequestException("You cannot report your own message.");
    }

    return this.prisma.messageReport.create({
      data: {
        conversationId: participants.conversationId,
        messageId: message.id,
        reporterId: user.id,
        reportedUserId: message.senderId,
        reason: dto.reason,
      },
    });
  }

  async reportUser(user: User, bookingId: string, dto: ReportDto) {
    const participants = await this.getBookingParticipants(bookingId);
    this.assertParticipant(user, participants);

    return this.prisma.messageReport.create({
      data: {
        conversationId: participants.conversationId,
        reporterId: user.id,
        reportedUserId: this.otherParticipantUserId(user, participants),
        reason: dto.reason,
      },
    });
  }

  async blockUser(user: User, bookingId: string) {
    const participants = await this.getBookingParticipants(bookingId);
    this.assertParticipant(user, participants);

    return this.prisma.conversationBlock.upsert({
      where: {
        conversationId_blockedByUserId: {
          conversationId: participants.conversationId,
          blockedByUserId: user.id,
        },
      },
      update: {},
      create: {
        conversationId: participants.conversationId,
        blockedByUserId: user.id,
        blockedUserId: this.otherParticipantUserId(user, participants),
      },
    });
  }

  /**
   * Processes a Stream "message.new" webhook event (Task 4.1) by mirroring
   * it into our own Message table - the durable, admin-queryable store
   * Task 4.4 requires regardless of whether messages originated through
   * our own POST /messages or directly through a Stream client SDK.
   * Idempotent via the unique streamMessageId, so a retried webhook
   * delivery can't double-insert.
   */
  async handleStreamMessageEvent(event: {
    type?: string;
    message?: { id?: string; text?: string; user?: { id?: string } };
    cid?: string;
  }): Promise<void> {
    if (event.type !== "message.new" || !event.message?.id || !event.cid) {
      return;
    }
    const senderId = event.message.user?.id;
    const text = event.message.text;
    if (!senderId || text === undefined) return;

    const existing = await this.prisma.message.findUnique({
      where: { streamMessageId: event.message.id },
    });
    if (existing) return;

    const conversation = await this.prisma.conversation.findFirst({
      where: { streamChannelId: event.cid },
      include: {
        booking: {
          include: {
            student: { select: { userId: true } },
            tutor: { select: { userId: true } },
          },
        },
      },
    });
    if (!conversation) {
      this.logger.warn(`No conversation found for Stream channel ${event.cid} - dropping event.`);
      return;
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        body: text,
        streamMessageId: event.message.id,
      },
    });

    const recipientUserId =
      senderId === conversation.booking.student.userId
        ? conversation.booking.tutor.userId
        : conversation.booking.student.userId;
    await this.notifications.send(recipientUserId, "MESSAGE_RECEIVED", {
      bookingId: conversation.booking.id,
      messageId: message.id,
    });
  }

  /** Best-effort - called after booking creation commits (Task 4.1). Never throws; a Conversation row without a Stream channel is a fully valid, expected state until Stream is configured. */
  async createChannelForBooking(bookingId: string): Promise<void> {
    try {
      const participants = await this.getBookingParticipants(bookingId);
      const channelId = `booking-${participants.bookingId}`;
      const cid = await this.streamChat.createChannel(channelId, [
        participants.studentUserId,
        participants.tutorUserId,
      ]);
      await this.prisma.conversation.update({
        where: { id: participants.conversationId },
        data: { streamChannelId: cid },
      });
    } catch (err) {
      this.logger.warn(`Skipping Stream channel creation for booking ${bookingId}: ${err}`);
    }
  }
}
