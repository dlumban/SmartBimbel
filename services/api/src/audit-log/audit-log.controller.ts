import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuditLogService } from "./audit-log.service";
import { ListAuditLogDto } from "./dto/list-audit-log.dto";

// Read access for any admin sub-role (Task 7.1's AC: "recorded... to
// answer who did what, when" - both Support and Super Admin need to be
// able to look this up during a dispute review, not just Super Admin).
@Controller("internal/audit-log")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogDto) {
    return this.auditLogService.list(query);
  }
}
