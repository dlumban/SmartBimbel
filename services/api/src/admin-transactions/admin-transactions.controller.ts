import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminTransactionsService } from "./admin-transactions.service";
import { ListAdminTransactionsDto } from "./dto/list-admin-transactions.dto";

// Read-only for both admin sub-roles - approving payouts (the actual
// financial-approval action) lives in PayoutsModule's AdminPayoutsController
// and is Super-Admin-gated there.
@Controller("internal/transactions")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminTransactionsController {
  constructor(private readonly adminTransactionsService: AdminTransactionsService) {}

  @Get()
  list(@Query() query: ListAdminTransactionsDto) {
    return this.adminTransactionsService.list(query);
  }

  @Get("reconciliation")
  reconciliation() {
    return this.adminTransactionsService.reconciliation();
  }
}
