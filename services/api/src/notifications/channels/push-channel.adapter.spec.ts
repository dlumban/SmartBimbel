import { User } from "@prisma/client";
import { PushChannelAdapter } from "./push-channel.adapter";

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

describe("PushChannelAdapter", () => {
  it("always skips - no device-token registration flow exists yet", async () => {
    const adapter = new PushChannelAdapter();
    await expect(
      adapter.send({ user: makeUser(), type: "BOOKING_ACCEPTED", data: {} }),
    ).resolves.toBeUndefined();
  });
});
