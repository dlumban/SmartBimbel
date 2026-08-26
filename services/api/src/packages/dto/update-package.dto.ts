import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { ALLOWED_BOOKING_DURATIONS_MINUTES } from "@smartbimbel/shared";

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sessionCount?: number;

  @IsOptional()
  @IsIn(ALLOWED_BOOKING_DURATIONS_MINUTES)
  durationMinutes?: (typeof ALLOWED_BOOKING_DURATIONS_MINUTES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  totalPrice?: number;
}
