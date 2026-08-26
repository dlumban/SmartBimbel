import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { MidtransWebhookDto } from "./dto/midtrans-webhook.dto";

/**
 * Receives Midtrans's payment-status webhook (Task 5.1) - not behind
 * FirebaseAuthGuard (Midtrans, not one of our users, calls this),
 * protected instead by the SHA512 signature check inside
 * PaymentsService.handleWebhook. The webhook handler is the *only* place
 * that ever marks a transaction PAID (Task 5.1's technical note - never
 * trust a client-side redirect callback, which can be spoofed or
 * interrupted).
 */
@Controller("webhooks")
export class MidtransWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("midtrans")
  @HttpCode(200)
  async handleWebhook(@Body() payload: MidtransWebhookDto) {
    await this.paymentsService.handleWebhook(payload);
    return { received: true };
  }
}
