import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { ReportDto } from "./dto/report.dto";
import { ListMessagesDto } from "./dto/list-messages.dto";

@Controller("bookings/:bookingId")
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("chat/token")
  getToken(@CurrentUser() user: User, @Param("bookingId") bookingId: string) {
    return this.chatService.getToken(user, bookingId);
  }

  @Get("messages")
  listMessages(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chatService.listMessages(user, bookingId, query);
  }

  @Post("messages")
  sendMessage(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user, bookingId, dto);
  }

  @Post("messages/:messageId/report")
  reportMessage(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Param("messageId") messageId: string,
    @Body() dto: ReportDto,
  ) {
    return this.chatService.reportMessage(user, bookingId, messageId, dto);
  }

  @Post("report")
  reportUser(@CurrentUser() user: User, @Param("bookingId") bookingId: string, @Body() dto: ReportDto) {
    return this.chatService.reportUser(user, bookingId, dto);
  }

  @Post("block")
  blockUser(@CurrentUser() user: User, @Param("bookingId") bookingId: string) {
    return this.chatService.blockUser(user, bookingId);
  }
}
