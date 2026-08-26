import { User } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { WhatsAppChannelAdapter } from "./whatsapp-channel.adapter";

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

describe("WhatsAppChannelAdapter", () => {
  const originalFetch = global.fetch;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = { get: jest.fn() };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("skips when the user has no phone on file", async () => {
    global.fetch = jest.fn();
    const adapter = new WhatsAppChannelAdapter(config as unknown as ConfigService);
    await adapter.send({ user: makeUser({ phone: null }), type: "BOOKING_ACCEPTED", data: {} });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips when the BSP isn't configured", async () => {
    config.get.mockReturnValue(undefined);
    global.fetch = jest.fn();
    const adapter = new WhatsAppChannelAdapter(config as unknown as ConfigService);
    await adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls the BSP API when configured with a real recipient", async () => {
    config.get.mockImplementation((key: string) =>
      key === "WHATSAPP_BSP_API_URL" ? "https://bsp.example.com/send" : "test-key",
    );
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const adapter = new WhatsAppChannelAdapter(config as unknown as ConfigService);

    await adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://bsp.example.com/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws when the BSP responds with a non-2xx status", async () => {
    config.get.mockImplementation((key: string) =>
      key === "WHATSAPP_BSP_API_URL" ? "https://bsp.example.com/send" : "test-key",
    );
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const adapter = new WhatsAppChannelAdapter(config as unknown as ConfigService);

    await expect(
      adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} }),
    ).rejects.toThrow("WhatsApp delivery failed with status 500");
  });
});
