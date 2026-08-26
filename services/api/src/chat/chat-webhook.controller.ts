import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ChatService } from "./chat.service";
import { StreamChatService } from "./stream-chat.service";

/**
 * Receives Stream Chat's server-side webhook (Task 4.1) - not behind
 * FirebaseAuthGuard (Stream, not one of our users, calls this), protected
 * instead by HMAC signature verification when Stream is configured. When
 * it isn't, no real webhook URL could ever have been registered with
 * Stream in the first place, so this route sees no real traffic either
 * way - verification is simply skipped rather than rejecting everything.
 */
@Controller("chat")
export class ChatWebhookController {
  constructor(
    private readonly chatService: ChatService,
    private readonly streamChat: StreamChatService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-signature") signature?: string,
  ) {
    if (this.streamChat.isConfigured()) {
      if (!signature || !req.rawBody || !this.streamChat.verifyWebhook(req.rawBody, signature)) {
        throw new UnauthorizedException("Invalid webhook signature.");
      }
    }

    await this.chatService.handleStreamMessageEvent(req.body);
    return { received: true };
  }
}
