import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StreamChat } from "stream-chat";

/**
 * Thin wrapper around the Stream Chat Node SDK (Task 4.1, per the
 * sprints README's architectural decision to use a managed provider
 * instead of building/scaling a Socket.io deployment for MVP).
 * Initializes lazily, same pattern as FirebaseAdminService - no
 * STREAM_API_KEY/STREAM_API_SECRET is provisioned in this environment
 * (docs/third-party-setup.md), so every method throws a clear 503 rather
 * than the whole process crashing on boot. Conversation rows and our own
 * message persistence (ChatService) work regardless of whether Stream is
 * configured; only realtime delivery and token issuance are gated here.
 */
@Injectable()
export class StreamChatService {
  private readonly logger = new Logger(StreamChatService.name);
  private client: StreamChat | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("STREAM_API_KEY") && this.config.get<string>("STREAM_API_SECRET"),
    );
  }

  getPublicApiKey(): string | null {
    return this.config.get<string>("STREAM_API_KEY") ?? null;
  }

  private getClient(): StreamChat {
    if (this.client) return this.client;

    const apiKey = this.config.get<string>("STREAM_API_KEY");
    const apiSecret = this.config.get<string>("STREAM_API_SECRET");
    if (!apiKey || !apiSecret) {
      this.logger.warn(
        "Stream Chat is not configured (STREAM_API_KEY/STREAM_API_SECRET missing) - chat-dependent routes will return 503.",
      );
      throw new ServiceUnavailableException("Chat is not configured on this server yet.");
    }

    this.client = StreamChat.getInstance(apiKey, apiSecret);
    return this.client;
  }

  generateUserToken(userId: string): string {
    return this.getClient().createToken(userId);
  }

  /** Best-effort: creates (or reuses) a Stream "messaging" channel with exactly the two booking participants as members. Returns the channel's cid. */
  async createChannel(channelId: string, memberUserIds: string[]): Promise<string> {
    const client = this.getClient();
    await client.upsertUsers(memberUserIds.map((id) => ({ id })));
    const channel = client.channel("messaging", channelId, {
      members: memberUserIds,
      created_by_id: memberUserIds[0],
    });
    await channel.create();
    return channel.cid;
  }

  async sendMessage(channelId: string, senderId: string, text: string): Promise<void> {
    const client = this.getClient();
    const channel = client.channel("messaging", channelId);
    await channel.sendMessage({ text, user_id: senderId });
  }

  verifyWebhook(requestBody: string | Buffer, signature: string): boolean {
    return this.getClient().verifyWebhook(requestBody, signature);
  }
}
