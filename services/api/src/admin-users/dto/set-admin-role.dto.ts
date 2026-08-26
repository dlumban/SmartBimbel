import { IsIn } from "class-validator";
import { AdminRole } from "@prisma/client";

const ADMIN_ROLES: AdminRole[] = ["SUPER_ADMIN", "SUPPORT"];

export class SetAdminRoleDto {
  @IsIn(ADMIN_ROLES)
  adminRole!: AdminRole;
}
