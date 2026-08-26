import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { DisputesService } from "./disputes.service";
import { RaiseDisputeDto } from "./dto/raise-dispute.dto";

@Controller("bookings/:bookingId/disputes")
@UseGuards(FirebaseAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  raise(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.disputesService.raise(user, bookingId, dto);
  }

  @Get()
  list(@CurrentUser() user: User, @Param("bookingId") bookingId: string) {
    return this.disputesService.listForBooking(user, bookingId);
  }
}
