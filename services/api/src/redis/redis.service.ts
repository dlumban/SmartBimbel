import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Thin cache wrapper. Every call is defensive - a Redis outage degrades to
 * "always miss" (callers fall through to computing the value fresh) rather
 * than taking the API down, since nothing here is a source of truth.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL");
    if (url) {
      this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.client.on("error", (err) => this.logger.warn(`Redis error: ${err.message}`));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Cache write failures are non-fatal - the value just won't be cached.
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // Best-effort - a failed bust just means a stale value survives until
      // its TTL expires, not a correctness issue worth failing the caller.
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
