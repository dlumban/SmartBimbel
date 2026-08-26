import { IsString, MaxLength } from "class-validator";

export class AddSessionNotesDto {
  // Blank is valid (Task 6.3: "leaving notes blank doesn't block any other
  // flow") - this DTO is only used once notes are actually being written,
  // clearing them back to blank is a legitimate edit.
  @IsString()
  @MaxLength(5000)
  notes!: string;
}
