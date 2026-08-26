import { User } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { EmailChannelAdapter } from "./email-channel.adapter";

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

describe("EmailChannelAdapter", () => {
  const originalFetch = global.fetch;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = { get: jest.fn() };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("skips when the user has no email on file", async () => {
    global.fetch = jest.fn();
    const adapter = new EmailChannelAdapter(config as unknown as ConfigService);
    await adapter.send({ user: makeUser({ email: null }), type: "BOOKING_ACCEPTED", data: {} });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips when SendGrid isn't configured", async () => {
    config.get.mockReturnValue(undefined);
    global.fetch = jest.fn();
    const adapter = new EmailChannelAdapter(config as unknown as ConfigService);
    await adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls the SendGrid API when configured with a real recipient", async () => {
    config.get.mockReturnValue("test-api-key");
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const adapter = new EmailChannelAdapter(config as unknown as ConfigService);

    await adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.sendgrid.com/v3/mail/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws when SendGrid responds with a non-2xx status", async () => {
    config.get.mockReturnValue("test-api-key");
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const adapter = new EmailChannelAdapter(config as unknown as ConfigService);

    await expect(
      adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} }),
    ).rejects.toThrow("SendGrid email delivery failed with status 503");
  });
});
