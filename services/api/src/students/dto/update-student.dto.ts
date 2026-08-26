import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

// Same fields as CreateStudentDto, but every field optional - a PATCH, not a
// full replace. Unlike CreateStudentDto, phone/email aren't mutually
// required here: a tutor editing an existing student isn't necessarily
// touching either one. Note neither field can be sent as an empty string
// (MinLength(1)/IsEmail both reject that), so an update can only ever add or
// replace a phone/email, never clear it down to null - the "at least one of
// phone/email" invariant from creation is preserved automatically.
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  gradeLevelId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsString()
  preferredLocation?: string;

  @IsOptional()
  @IsIn(["ONLINE", "OFFLINE"])
  preferredMode?: "ONLINE" | "OFFLINE";
}
