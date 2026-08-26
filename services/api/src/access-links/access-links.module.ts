import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AccessLinksService } from "./access-links.service";
import { AdminAccessLinksController } from "./admin-access-links.controller";
import { TutorAccessLinksController } from "./tutor-access-links.controller";
import { AccessLinkRedeemController } from "./access-link-redeem.controller";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [AdminAccessLinksController, TutorAccessLinksController, AccessLinkRedeemController],
  providers: [AccessLinksService],
})
export class AccessLinksModule {}
