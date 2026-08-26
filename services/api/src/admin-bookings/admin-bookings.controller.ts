import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminRoleGuard } from "../auth/guards/admin-role.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminRoles } from "../auth/decorators/admin-roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminBookingsService } from "./admin-bookings.service";
import { SearchAdminBookingsDto } from "./dto/search-admin-bookings.dto";
import { OverrideCancelBookingDto } from "./dto/override-cancel-booking.dto";

// Both admin sub-roles can view (PRD §5); only Super Admin can override
// booking state (Task 7.3's AC: "restricted to Super Admin and fully
// audit-logged", given its potential to affect payments).
@Controller("internal/bookings")
@UseGuards(FirebaseAuthGuard, RolesGuard, AdminRoleGuard)
@Roles("ADMIN")
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  search(@Query() query: SearchAdminBookingsDto) {
    return this.adminBookingsService.search(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.adminBookingsService.detail(id);
  }

  @Patch(":id/override-cancel")
  @AdminRoles("SUPER_ADMIN")
  overrideCancel(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: OverrideCancelBookingDto,
  ) {
    return this.adminBookingsService.overrideCancel(admin, id, dto);
  }
}
