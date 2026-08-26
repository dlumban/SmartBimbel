import { IsIn, IsInt, IsString, Min, MinLength } from "class-validator";
import { ALLOWED_BOOKING_DURATIONS_MINUTES } from "@smartbimbel/shared";

export class CreatePackageDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  sessionCount!: number;

  @IsIn(ALLOWED_BOOKING_DURATIONS_MINUTES)
  durationMinutes!: (typeof ALLOWED_BOOKING_DURATIONS_MINUTES)[number];

  // Total price for the whole bundle, in the smallest currency unit (same
  // convention as Booking.priceAmount) - not a per-session price.
  @IsInt()
  @Min(1)
  totalPrice!: number;
}
