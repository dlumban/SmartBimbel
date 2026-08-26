import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PayoutsController } from "./payouts.controller";
import { AdminPayoutsController } from "./admin-payouts.controller";
import { PayoutsService } from "./payouts.service";

@Module({
  imports: [AuthModule, NotificationsModule, PaymentsModule, AuditLogModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
