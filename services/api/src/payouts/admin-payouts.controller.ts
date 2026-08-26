import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminRoleGuard } from "../auth/guards/admin-role.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminRoles } from "../auth/decorators/admin-roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PayoutsService } from "./payouts.service";
import { UpdatePayoutStatusDto } from "./dto/update-payout-status.dto";

/**
 * Payout processing (Task 7.4) - the pending queue is viewable by either
 * admin sub-role, but approving/rejecting is Super-Admin-only per PRD §5
 * and Task 7.1's RBAC split ("financial approval rights"), formalizing
 * what was an informal /internal stopgap since Task 5.5.
 */
@Controller("internal/payouts")
@UseGuards(FirebaseAuthGuard, RolesGuard, AdminRoleGuard)
@Roles("ADMIN")
export class AdminPayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get("pending")
  listPending() {
    return this.payoutsService.listPending();
  }

  @Patch(":id/status")
  @AdminRoles("SUPER_ADMIN")
  updateStatus(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: UpdatePayoutStatusDto,
  ) {
    return this.payoutsService.updateStatus(admin, id, dto);
  }
}
