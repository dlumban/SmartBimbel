import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PaymentsService } from "./payments.service";
import { ListTransactionsDto } from "./dto/list-transactions.dto";

@Controller()
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("bookings/:id/pay")
  @Roles("STUDENT")
  pay(@CurrentUser() user: User, @Param("id") id: string) {
    return this.paymentsService.initiatePayment(user, id);
  }

  @Get("transactions")
  listTransactions(@CurrentUser() user: User, @Query() query: ListTransactionsDto) {
    return this.paymentsService.listTransactions(user, query);
  }
}
