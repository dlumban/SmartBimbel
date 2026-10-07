import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches } from "class-validator";
import { ALLOWED_BOOKING_DURATIONS_MINUTES, MAX_GROUP_SESSION_STUDENTS } from "@smartbimbel/shared";

/**
 * Tutor-only group session create (Phase 2): 2–8 students share one calendar
 * slot via BookingGroup + one Booking row per student.
 */
export class CreateGroupBookingDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(MAX_GROUP_SESSION_STUDENTS)
  @IsString({ each: true })
  studentIds!: string[];

  @IsString()
  subjectId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "scheduledDate must be an ISO date (YYYY-MM-DD)" })
  scheduledDate!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/, {
    message: "startTime must be a half-hour-aligned HH:mm (e.g. 14:00 or 14:30)",
  })
  startTime!: string;

  @IsIn(ALLOWED_BOOKING_DURATIONS_MINUTES)
  durationMinutes!: (typeof ALLOWED_BOOKING_DURATIONS_MINUTES)[number];

  @IsIn(["ONLINE", "OFFLINE"])
  mode!: "ONLINE" | "OFFLINE";

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  packageId?: string;
}
