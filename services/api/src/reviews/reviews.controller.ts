import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ReviewsService } from "./reviews.service";
import { SubmitReviewDto } from "./dto/submit-review.dto";

@Controller("bookings/:bookingId/review")
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles("STUDENT")
  submit(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.reviewsService.submit(user, bookingId, dto);
  }

  @Get()
  get(@CurrentUser() user: User, @Param("bookingId") bookingId: string) {
    return this.reviewsService.getForBooking(user, bookingId);
  }
}
