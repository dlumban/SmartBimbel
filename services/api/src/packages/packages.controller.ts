import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminRoleGuard } from "../auth/guards/admin-role.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PackagesService } from "./packages.service";
import { CreatePackageDto } from "./dto/create-package.dto";
import { UpdatePackageDto } from "./dto/update-package.dto";
import { SetPackageActiveDto } from "./dto/set-package-active.dto";

@Controller("internal/packages")
@UseGuards(FirebaseAuthGuard, RolesGuard, AdminRoleGuard)
@Roles("ADMIN")
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  list() {
    return this.packagesService.adminList();
  }

  @Post()
  create(@CurrentUser() admin: User, @Body() dto: CreatePackageDto) {
    return this.packagesService.adminCreate(admin, dto);
  }

  @Patch(":id")
  update(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.adminUpdate(admin, id, dto);
  }

  @Patch(":id/active")
  setActive(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetPackageActiveDto,
  ) {
    return this.packagesService.adminSetActive(admin, id, dto.isActive);
  }
}
