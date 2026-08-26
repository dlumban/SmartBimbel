import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { UserRole, UserStatus } from "@prisma/client";

const ROLES: UserRole[] = ["STUDENT", "TUTOR", "ADMIN"];
const STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED"];

export class SearchUsersDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;

  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
