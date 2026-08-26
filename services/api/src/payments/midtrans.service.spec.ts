import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { CoreApi, Snap } from "midtrans-client";
import { MidtransService } from "./midtrans.service";

jest.mock("midtrans-client", () => ({
  Snap: jest.fn(),
  CoreApi: jest.fn(),
}));

function makeConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("MidtransService", () => {
  const SnapMock = Snap as unknown as jest.Mock;
  const CoreApiMock = CoreApi as unknown as jest.Mock;

  beforeEach(() => {
    SnapMock.mockReset();
    CoreApiMock.mockReset();
  });

  describe("when unconfigured", () => {
    const service = new MidtransService(makeConfig({}));

    it("isConfigured() is false", () => {
      expect(service.isConfigured()).toBe(false);
    });

    it("throws ServiceUnavailableException from createSnapTransaction", async () => {
      await expect(service.createSnapTransaction("order1", 100000)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("throws ServiceUnavailableException from verifySignature", () => {
      expect(() =>
        service.verifySignature({
          orderId: "order1",
          statusCode: "200",
          grossAmount: "100000.00",
          signatureKey: "whatever",
        }),
      ).toThrow(ServiceUnavailableException);
    });

    it("throws ServiceUnavailableException from refund", async () => {
      await expect(service.refund("gw-ref-1")).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe("when configured", () => {
    const createTransaction = jest
      .fn()
      .mockResolvedValue({ token: "snap-token", redirect_url: "https://snap.example/pay" });

    beforeEach(() => {
      SnapMock.mockImplementation(() => ({ createTransaction }));
    });

    function makeService() {
      return new MidtransService(
        makeConfig({ MIDTRANS_SERVER_KEY: "server-key", MIDTRANS_CLIENT_KEY: "client-key" }),
      );
    }

    it("isConfigured() is true", () => {
      expect(makeService().isConfigured()).toBe(true);
    });

    it("creates a Snap transaction with the given order id and amount", async () => {
      const result = await makeService().createSnapTransaction("order1", 100000);
      expect(result).toEqual({ token: "snap-token", redirectUrl: "https://snap.example/pay" });
      expect(createTransaction).toHaveBeenCalledWith({
        transaction_details: { order_id: "order1", gross_amount: 100000 },
      });
    });

    it("computes the exact Midtrans signature algorithm (SHA512 of orderId+statusCode+grossAmount+serverKey)", () => {
      const service = makeService();
      const expected = crypto
        .createHash("sha512")
        .update("order1" + "200" + "100000.00" + "server-key")
        .digest("hex");

      expect(
        service.verifySignature({
          orderId: "order1",
          statusCode: "200",
          grossAmount: "100000.00",
          signatureKey: expected,
        }),
      ).toBe(true);
    });

    it("rejects a tampered signature", () => {
      const service = makeService();
      expect(
        service.verifySignature({
          orderId: "order1",
          statusCode: "200",
          grossAmount: "100000.00",
          signatureKey: "not-the-real-signature",
        }),
      ).toBe(false);
    });

    it("reuses the same Snap client instance across calls", async () => {
      const service = makeService();
      await service.createSnapTransaction("order1", 1000);
      await service.createSnapTransaction("order2", 2000);
      expect(SnapMock).toHaveBeenCalledTimes(1);
    });

    it("calls the Core API's transaction.refund with the given amount and reason", async () => {
      const refund = jest.fn().mockResolvedValue({ status_code: "200", refund_amount: "50000.00" });
      CoreApiMock.mockImplementation(() => ({ transaction: { refund } }));

      const result = await makeService().refund("gw-ref-1", 50000, "Session cancelled");

      expect(refund).toHaveBeenCalledWith("gw-ref-1", {
        amount: 50000,
        reason: "Session cancelled",
      });
      expect(result).toEqual({ status_code: "200", refund_amount: "50000.00" });
    });
  });
});
