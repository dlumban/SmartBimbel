import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { DisputesService } from "./disputes.service";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";

/**
 * Dispute resolution tools (Task 7.5) - open to either admin sub-role per
 * PRD §5 ("Support: user/booking/dispute handling"); the underlying
 * RESOLVED_REFUND path still calls Midtrans (Task 5.6) regardless of
 * which sub-role triggered it, since a refund on a specific dispute isn't
 * the same class of action as bulk payout approval.
 */
@Controller("internal/disputes")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  listAll() {
    return this.disputesService.listAll();
  }

  @Patch(":id/resolve")
  resolve(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputesService.resolve(admin, id, dto);
  }
}
