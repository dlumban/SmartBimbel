import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { BookingStatus } from "@prisma/client";

const STATUSES: BookingStatus[] = [
  "REQUESTED",
  "COUNTER_PROPOSED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULE_PROPOSED",
];

export class SearchAdminBookingsDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

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
  @Max(500)
  limit?: number;
}
