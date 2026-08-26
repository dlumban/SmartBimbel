import { IsString, MinLength } from "class-validator";

export class OverrideCancelBookingDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
