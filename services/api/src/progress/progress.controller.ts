import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProgressService } from "./progress.service";
import { UpsertProgressReportDto } from "./dto/upsert-progress-report.dto";
import { CreateHomeworkDto, ReviewHomeworkDto, SubmitHomeworkDto } from "./dto/homework.dto";

@Controller()
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get("bookings/:id/progress-report")
  @Roles("STUDENT", "TUTOR")
  getProgressReport(@CurrentUser() user: User, @Param("id") id: string) {
    return this.progressService.getProgressReport(user, id);
  }

  @Put("bookings/:id/progress-report")
  @Roles("TUTOR")
  upsertProgressReport(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpsertProgressReportDto,
  ) {
    return this.progressService.upsertProgressReport(user, id, dto);
  }

  @Get("bookings/:id/homework")
  @Roles("STUDENT", "TUTOR")
  listHomework(@CurrentUser() user: User, @Param("id") id: string) {
    return this.progressService.listHomework(user, id);
  }

  @Post("bookings/:id/homework")
  @Roles("TUTOR")
  createHomework(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CreateHomeworkDto,
  ) {
    return this.progressService.createHomework(user, id, dto);
  }

  @Post("homework/:id/submit")
  @Roles("STUDENT")
  submitHomework(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: SubmitHomeworkDto,
  ) {
    return this.progressService.submitHomework(user, id, dto);
  }

  @Patch("homework/:id/review")
  @Roles("TUTOR")
  reviewHomework(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ReviewHomeworkDto,
  ) {
    return this.progressService.reviewHomework(user, id, dto);
  }
}
