import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "./payments.controller";
import { MidtransWebhookController } from "./midtrans-webhook.controller";
import { EarningsController } from "./earnings.controller";
import { PaymentsService } from "./payments.service";
import { MidtransService } from "./midtrans.service";
import { EarningsService } from "./earnings.service";
import { PaymentExpiryProcessor } from "./processors/payment-expiry.processor";

@Module({
  imports: [AuthModule, JobsModule, NotificationsModule],
  controllers: [PaymentsController, MidtransWebhookController, EarningsController],
  providers: [PaymentsService, MidtransService, EarningsService, PaymentExpiryProcessor],
  exports: [PaymentsService, MidtransService, EarningsService],
})
export class PaymentsModule {}
