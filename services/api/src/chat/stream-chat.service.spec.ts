import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StreamChat } from "stream-chat";
import { StreamChatService } from "./stream-chat.service";

jest.mock("stream-chat", () => ({
  StreamChat: { getInstance: jest.fn() },
}));

function makeConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("StreamChatService", () => {
  const getInstance = StreamChat.getInstance as jest.Mock;

  beforeEach(() => {
    getInstance.mockReset();
  });

  describe("when unconfigured", () => {
    const service = new StreamChatService(makeConfig({}));

    it("isConfigured() is false", () => {
      expect(service.isConfigured()).toBe(false);
    });

    it("throws ServiceUnavailableException from generateUserToken", () => {
      expect(() => service.generateUserToken("u1")).toThrow(ServiceUnavailableException);
    });

    it("throws ServiceUnavailableException from createChannel", async () => {
      await expect(service.createChannel("c1", ["u1", "u2"])).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("never calls the Stream SDK", () => {
      expect(getInstance).not.toHaveBeenCalled();
    });
  });

  describe("when configured", () => {
    const createToken = jest.fn().mockReturnValue("fake-token");
    const upsertUsers = jest.fn().mockResolvedValue({});
    const channelCreate = jest.fn().mockResolvedValue({});
    const sendMessage = jest.fn().mockResolvedValue({});
    const channel = jest.fn().mockReturnValue({
      cid: "messaging:c1",
      create: channelCreate,
      sendMessage,
    });
    const verifyWebhook = jest.fn().mockReturnValue(true);

    beforeEach(() => {
      getInstance.mockReturnValue({ createToken, upsertUsers, channel, verifyWebhook });
    });

    function makeService() {
      return new StreamChatService(
        makeConfig({ STREAM_API_KEY: "key", STREAM_API_SECRET: "secret" }),
      );
    }

    it("isConfigured() is true", () => {
      expect(makeService().isConfigured()).toBe(true);
    });

    it("generates a token via the SDK", () => {
      expect(makeService().generateUserToken("u1")).toBe("fake-token");
      expect(createToken).toHaveBeenCalledWith("u1");
    });

    it("creates a channel with exactly the given members", async () => {
      const cid = await makeService().createChannel("c1", ["u1", "u2"]);
      expect(cid).toBe("messaging:c1");
      expect(upsertUsers).toHaveBeenCalledWith([{ id: "u1" }, { id: "u2" }]);
      expect(channel).toHaveBeenCalledWith("messaging", "c1", {
        members: ["u1", "u2"],
        created_by_id: "u1",
      });
      expect(channelCreate).toHaveBeenCalled();
    });

    it("sends a message through the channel", async () => {
      await makeService().sendMessage("c1", "u1", "hello");
      expect(channel).toHaveBeenCalledWith("messaging", "c1");
      expect(sendMessage).toHaveBeenCalledWith({ text: "hello", user_id: "u1" });
    });

    it("reuses the same client instance across calls", () => {
      const service = makeService();
      service.generateUserToken("u1");
      service.generateUserToken("u2");
      expect(getInstance).toHaveBeenCalledTimes(1);
    });
  });
});
