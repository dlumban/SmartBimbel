import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { ALLOWED_BOOKING_DURATIONS_MINUTES } from "@smartbimbel/shared";

const ALLOWED_DURATIONS_MINUTES = ALLOWED_BOOKING_DURATIONS_MINUTES;

// Every field optional (direct tutor edit of a session they scheduled
// themselves - BookingsService.editForTutor) - scheduledDate/startTime must
// be supplied together, validated in the service rather than here, same
// convention as CreateBookingDto.
export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "scheduledDate must be in YYYY-MM-DD format" })
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/, { message: "startTime must be in HH:mm format, on the hour or half-hour" })
  startTime?: string;

  @IsOptional()
  @IsIn(ALLOWED_DURATIONS_MINUTES)
  durationMinutes?: (typeof ALLOWED_DURATIONS_MINUTES)[number];

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsIn(["ONLINE", "OFFLINE"])
  mode?: "ONLINE" | "OFFLINE";

  @IsOptional()
  @IsString()
  notes?: string;
}
