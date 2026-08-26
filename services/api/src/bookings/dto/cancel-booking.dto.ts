import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CancellationReasonCode } from "@prisma/client";

const REASON_CODES: CancellationReasonCode[] = [
  "SCHEDULE_CONFLICT",
  "ILLNESS",
  "FOUND_ALTERNATIVE",
  "NO_LONGER_NEEDED",
  "OTHER",
];

export class CancelBookingDto {
  @IsIn(REASON_CODES)
  reasonCode!: CancellationReasonCode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
