import { Controller, Delete, Param, Post, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminRoleGuard } from "../auth/guards/admin-role.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessLinksService } from "./access-links.service";

@Controller("internal/users")
@UseGuards(FirebaseAuthGuard, RolesGuard, AdminRoleGuard)
@Roles("ADMIN")
export class AdminAccessLinksController {
  constructor(private readonly accessLinksService: AccessLinksService) {}

  @Post(":id/access-link")
  generate(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.accessLinksService.generate(admin, id);
  }

  @Delete(":id/access-link")
  deactivate(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.accessLinksService.deactivate(admin, id);
  }
}
