import { Controller, Get, UseGuards } from "@nestjs/common";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { DisputesService } from "./disputes.service";

// Reported chat messages/users (Task 4.4) surfaced alongside disputes
// (Task 7.5) - a separate controller (rather than routes nested under
// /internal/disputes) since a report isn't always tied to a dispute.
@Controller("internal/reports")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminReportsController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  list() {
    return this.disputesService.listReports();
  }
}
