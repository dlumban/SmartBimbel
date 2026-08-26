import { Controller, Delete, Param, Post, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessLinksService } from "./access-links.service";

// Route lives under /students (not /internal/users, which is admin-only) -
// no collision with StudentsController's routes (/students, /students/
// profile, /students/me). Ownership check (this tutor added the target
// student) happens inside AccessLinksService.generateForTutor().
@Controller("students")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("TUTOR")
export class TutorAccessLinksController {
  constructor(private readonly accessLinksService: AccessLinksService) {}

  @Post(":id/access-link")
  generate(@CurrentUser() tutor: User, @Param("id") id: string) {
    return this.accessLinksService.generateForTutor(tutor, id);
  }

  @Delete(":id/access-link")
  deactivate(@CurrentUser() tutor: User, @Param("id") id: string) {
    return this.accessLinksService.deactivateForTutor(tutor, id);
  }
}
