import { IsOptional, IsString, MaxLength } from "class-validator";

export class SetMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingAddress?: string;
}
