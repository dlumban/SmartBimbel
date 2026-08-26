import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminRoleGuard } from "../auth/guards/admin-role.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminRoles } from "../auth/decorators/admin-roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminUsersService } from "./admin-users.service";
import { SearchUsersDto } from "./dto/search-users.dto";
import { SuspendUserDto } from "./dto/suspend-user.dto";
import { SetAdminRoleDto } from "./dto/set-admin-role.dto";
import { CreateStudentDto } from "../students/dto/create-student.dto";

// Both admin sub-roles can view/suspend/reinstate (PRD §5: "Support: user/
// booking/dispute handling") - only role management is Super-Admin-only,
// gated per-route below rather than at class level.
@Controller("internal/users")
@UseGuards(FirebaseAuthGuard, RolesGuard, AdminRoleGuard)
@Roles("ADMIN")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  search(@Query() query: SearchUsersDto) {
    return this.adminUsersService.search(query);
  }

  @Post("students")
  createStudent(@CurrentUser() admin: User, @Body() dto: CreateStudentDto) {
    return this.adminUsersService.createStudent(admin, dto);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.adminUsersService.detail(id);
  }

  @Patch(":id/suspend")
  suspend(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: SuspendUserDto) {
    return this.adminUsersService.suspend(admin, id, dto.reason);
  }

  @Patch(":id/reinstate")
  reinstate(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.adminUsersService.reinstate(admin, id);
  }

  @Patch(":id/admin-role")
  @AdminRoles("SUPER_ADMIN")
  setAdminRole(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: SetAdminRoleDto) {
    return this.adminUsersService.setAdminRole(admin, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.adminUsersService.remove(admin, id);
  }
}
