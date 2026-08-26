import { Controller, Get, Param, Query } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { ListTutorReviewsDto } from "./dto/list-tutor-reviews.dto";

// Public discovery route (Task 6.5, closes Sprint 2's empty "Ulasan"
// state) - same no-guard convention as GET /tutors/:id.
@Controller("tutors")
export class TutorReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(":id/reviews")
  list(@Param("id") id: string, @Query() query: ListTutorReviewsDto) {
    return this.reviewsService.listForTutor(id, query.page, query.limit);
  }
}
