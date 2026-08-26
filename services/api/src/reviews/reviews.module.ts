import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReviewsController } from "./reviews.controller";
import { TutorReviewsController } from "./tutor-reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController, TutorReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
