import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { SetRoleDto } from "./dto/set-role.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";

@Controller("users")
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: User) {
    return this.usersService.toSummary(user);
  }

  @Patch("me")
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    const updated = await this.usersService.updateName(user, dto.name);
    return this.usersService.toSummary(updated);
  }

  @Patch("me/role")
  async setRole(@CurrentUser() user: User, @Body() dto: SetRoleDto) {
    const updated = await this.usersService.setRole(user, dto.role);
    return this.usersService.toSummary(updated);
  }

  @Patch("me/notification-preferences")
  async updateNotificationPreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const updated = await this.usersService.updateNotificationPreferences(user, dto.whatsappOptOut);
    return this.usersService.toSummary(updated);
  }
}
