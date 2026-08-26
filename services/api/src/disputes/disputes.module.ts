import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { DisputesController } from "./disputes.controller";
import { AdminDisputesController } from "./admin-disputes.controller";
import { AdminReportsController } from "./admin-reports.controller";
import { DisputesService } from "./disputes.service";

@Module({
  imports: [AuthModule, NotificationsModule, PaymentsModule, AuditLogModule],
  controllers: [DisputesController, AdminDisputesController, AdminReportsController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
