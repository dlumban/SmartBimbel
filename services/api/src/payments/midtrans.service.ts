import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { CoreApi, Snap } from "midtrans-client";

interface RefundResult {
  status_code: string;
  refund_amount?: string;
}

/**
 * Thin wrapper around the Midtrans Snap/Core API SDK (Task 5.1, per the
 * sprints README's architectural decision - Snap's hosted checkout page
 * for MVP, per the task's own technical note, to minimize PCI scope and
 * implementation time). Same lazy-init/clear-503 pattern as
 * FirebaseAdminService and StreamChatService - no MIDTRANS_SERVER_KEY/
 * MIDTRANS_CLIENT_KEY is provisioned in this environment
 * (docs/third-party-setup.md), so every method throws until real
 * (sandbox or production) credentials are configured. This is the
 * highest-risk integration in the app (real money movement per the
 * sprint README) - never silently degrade to a fake "success"; always
 * fail loudly and clearly when unconfigured or when Midtrans itself
 * reports a problem.
 */
@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);
  private snapClient: Snap | null = null;
  private coreApiClient: CoreApi | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("MIDTRANS_SERVER_KEY") &&
        this.config.get<string>("MIDTRANS_CLIENT_KEY"),
    );
  }

  private getClientOptions() {
    const serverKey = this.config.get<string>("MIDTRANS_SERVER_KEY");
    const clientKey = this.config.get<string>("MIDTRANS_CLIENT_KEY");
    if (!serverKey || !clientKey) {
      this.logger.warn(
        "Midtrans is not configured (MIDTRANS_SERVER_KEY/MIDTRANS_CLIENT_KEY missing) - payment routes will return 503.",
      );
      throw new ServiceUnavailableException("Payments are not configured on this server yet.");
    }
    return {
      isProduction: this.config.get<string>("MIDTRANS_IS_PRODUCTION") === "true",
      serverKey,
      clientKey,
    };
  }

  private getSnap(): Snap {
    if (this.snapClient) return this.snapClient;
    this.snapClient = new Snap(this.getClientOptions());
    return this.snapClient;
  }

  private getCoreApi(): CoreApi {
    if (this.coreApiClient) return this.coreApiClient;
    this.coreApiClient = new CoreApi(this.getClientOptions());
    return this.coreApiClient;
  }

  async createSnapTransaction(
    orderId: string,
    grossAmount: number,
  ): Promise<{ token: string; redirectUrl: string }> {
    const snap = this.getSnap();
    const result = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
    });
    return { token: result.token, redirectUrl: result.redirect_url };
  }

  /**
   * Midtrans signs every webhook payload as
   * SHA512(order_id + status_code + gross_amount + server_key) - this is
   * a plain hash comparison, not an SDK call, so it works even when
   * `isConfigured()` would otherwise gate a real API request (there's
   * nothing to gate here beyond needing the server key itself).
   */
  verifySignature(params: {
    orderId: string;
    statusCode: string;
    grossAmount: string;
    signatureKey: string;
  }): boolean {
    const serverKey = this.config.get<string>("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      throw new ServiceUnavailableException("Payments are not configured on this server yet.");
    }
    const expected = crypto
      .createHash("sha512")
      .update(params.orderId + params.statusCode + params.grossAmount + serverKey)
      .digest("hex");
    return expected === params.signatureKey;
  }

  async refund(gatewayRef: string, amount?: number, reason?: string): Promise<RefundResult> {
    const coreApi = this.getCoreApi();
    // `transaction.refund` exists on the real SDK but isn't covered by the
    // community @types/midtrans-client definitions (only `charge` is
    // typed on CoreApi) - narrowly widening the type here rather than
    // fighting incomplete third-party types for one call.
    const client = coreApi as unknown as {
      transaction: { refund(id: string, params: Record<string, unknown>): Promise<RefundResult> };
    };
    return client.transaction.refund(gatewayRef, {
      amount,
      reason: reason ?? "Dispute resolved with refund",
    });
  }
}
