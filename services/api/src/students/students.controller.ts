import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { StudentsService } from "./students.service";
import { UpsertStudentProfileDto } from "./dto/upsert-student-profile.dto";
import { UpdateStudentProfileDto } from "./dto/update-student-profile.dto";
import { ListStudentsDto } from "./dto/list-students.dto";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";

@Controller("students")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("STUDENT")
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post("profile")
  createProfile(@CurrentUser() user: User, @Body() dto: UpsertStudentProfileDto) {
    return this.studentsService.createProfile(user, dto);
  }

  // Method-level @Roles overrides the controller's class-level
  // @Roles("STUDENT") (RolesGuard reads handler metadata first) - lets a
  // TUTOR browse/search students to schedule a session with, without
  // opening any other route on this controller to tutors. No :id-shaped
  // route on this controller, so no collision risk with the literal path.
  @Get()
  @Roles("TUTOR")
  list(@CurrentUser() tutor: User, @Query() dto: ListStudentsDto) {
    return this.studentsService.listForTutor(tutor, dto);
  }

  // Method-level @Roles override, same convention as list() above - lets a
  // TUTOR add a student directly (an offline referral/walk-in), private to
  // them, without opening any other route on this controller to tutors.
  @Post()
  @Roles("TUTOR")
  create(@CurrentUser() tutor: User, @Body() dto: CreateStudentDto) {
    return this.studentsService.createForTutor(tutor, dto);
  }

  @Get("me")
  getMyProfile(@CurrentUser() user: User) {
    return this.studentsService.getMyProfile(user);
  }

  @Patch("me")
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateStudentProfileDto) {
    return this.studentsService.updateProfile(user, dto);
  }

  // Method-level @Roles override, same convention as list()/create() above -
  // lets a TUTOR edit a student they added. Declared after "me" (source
  // order matters: Nest matches PATCH routes in declaration order, so the
  // static "me" segment must stay registered before this dynamic ":id").
  @Patch(":id")
  @Roles("TUTOR")
  update(@CurrentUser() tutor: User, @Param("id") id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.updateForTutor(tutor, id, dto);
  }
}
