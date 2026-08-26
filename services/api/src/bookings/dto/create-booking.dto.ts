import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { ALLOWED_BOOKING_DURATIONS_MINUTES } from "@smartbimbel/shared";

export const ALLOWED_DURATIONS_MINUTES = ALLOWED_BOOKING_DURATIONS_MINUTES;

// Exactly one of tutorId/studentId is required, matching the caller's
// role (a STUDENT supplies tutorId to pick who they're booking; a TUTOR
// supplies studentId to pick who they're scheduling with) - enforced in
// BookingsService.create(), not here, same as SetMeetingDto's two
// independently-optional fields.
export class CreateBookingDto {
  @IsOptional()
  @IsString()
  tutorId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsString()
  subjectId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "scheduledDate must be an ISO date (YYYY-MM-DD)" })
  scheduledDate!: string;

  // No more pre-declared AvailabilitySlot to pick from - any future
  // half-hour not already booked is fair game, so the caller names the
  // exact local start time directly.
  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/, {
    message: "startTime must be a half-hour-aligned HH:mm (e.g. 14:00 or 14:30)",
  })
  startTime!: string;

  @IsIn(ALLOWED_DURATIONS_MINUTES)
  durationMinutes!: (typeof ALLOWED_DURATIONS_MINUTES)[number];

  @IsIn(["ONLINE", "OFFLINE"])
  mode!: "ONLINE" | "OFFLINE";

  @IsOptional()
  @IsString()
  notes?: string;

  // When set, this booking's pricing is overridden by the package's
  // totalPrice/sessionCount instead of the tutor's hourlyRate, and
  // durationMinutes must match the package's durationMinutes exactly
  // (validated in BookingsService.create()).
  @IsOptional()
  @IsString()
  packageId?: string;
}
