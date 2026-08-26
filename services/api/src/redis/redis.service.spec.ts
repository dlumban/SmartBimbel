import { ConfigService } from "@nestjs/config";
import { RedisService } from "./redis.service";

describe("RedisService (against the real local Redis from docker-compose)", () => {
  let service: RedisService;

  beforeEach(() => {
    const config = {
      get: (key: string) => (key === "REDIS_URL" ? "redis://localhost:6380" : undefined),
    } as unknown as ConfigService;
    service = new RedisService(config);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it("returns null for a key that was never set", async () => {
    const result = await service.get(`test:missing:${Date.now()}`);
    expect(result).toBeNull();
  });

  it("round-trips a JSON-serializable value", async () => {
    const key = `test:roundtrip:${Date.now()}`;
    await service.set(key, { hello: "world", count: 3 }, 30);
    const result = await service.get<{ hello: string; count: number }>(key);
    expect(result).toEqual({ hello: "world", count: 3 });
  });

  it("expires a key after its TTL", async () => {
    const key = `test:ttl:${Date.now()}`;
    await service.set(key, "value", 1);
    await new Promise((r) => setTimeout(r, 1500));
    const result = await service.get(key);
    expect(result).toBeNull();
  }, 10_000);

  it("degrades gracefully (returns null) when misconfigured rather than throwing", async () => {
    const badConfig = { get: () => undefined } as unknown as ConfigService;
    const unconfigured = new RedisService(badConfig);
    await expect(unconfigured.get("anything")).resolves.toBeNull();
    await expect(unconfigured.set("anything", "x", 10)).resolves.toBeUndefined();
  });
});
