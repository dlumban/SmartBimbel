import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PayoutsService } from "./payouts.service";
import { SetBankDetailsDto } from "./dto/set-bank-details.dto";
import { RequestPayoutDto } from "./dto/request-payout.dto";

@Controller()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("TUTOR")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Patch("tutors/me/bank-details")
  setBankDetails(@CurrentUser() user: User, @Body() dto: SetBankDetailsDto) {
    return this.payoutsService.setBankDetails(user, dto);
  }

  @Post("payouts/request")
  requestPayout(@CurrentUser() user: User, @Body() dto: RequestPayoutDto) {
    return this.payoutsService.requestPayout(user, dto);
  }

  @Get("payouts")
  listMyPayouts(@CurrentUser() user: User) {
    return this.payoutsService.listMyPayouts(user);
  }
}
