import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface DailyRoom {
  name: string;
  url: string;
}

interface DailyMeetingTokenResponse {
  token: string;
}

/**
 * Lazy Daily.co client (Phase 2 in-app video). When DAILY_API_KEY is unset,
 * callers fall back to external Zoom/Meet links — same pattern as Stream Chat.
 */
@Injectable()
export class DailyService {
  private readonly logger = new Logger(DailyService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("DAILY_API_KEY"));
  }

  private apiKey(): string {
    const key = this.config.get<string>("DAILY_API_KEY");
    if (!key) {
      this.logger.warn("Daily is not configured (DAILY_API_KEY missing).");
      throw new ServiceUnavailableException(
        "In-app video is not configured on this server yet.",
      );
    }
    return key;
  }

  async createRoom(name: string): Promise<DailyRoom> {
    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Daily createRoom failed: ${res.status} ${body}`);
      throw new ServiceUnavailableException("Failed to create video room.");
    }
    const data = (await res.json()) as { name: string; url: string };
    return { name: data.name, url: data.url };
  }

  async createMeetingToken(roomName: string, userName: string, isOwner: boolean): Promise<string> {
    const res = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          is_owner: isOwner,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Daily meeting token failed: ${res.status} ${body}`);
      throw new ServiceUnavailableException("Failed to issue video token.");
    }
    const data = (await res.json()) as DailyMeetingTokenResponse;
    return data.token;
  }
}
