import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from "class-validator";

// Mirrors UpsertStudentProfileDto's optional fields, but gradeLevelId/
// subjectIds are optional here - an admin filling this in over the phone
// often won't have that detail on hand yet, unlike the student's own
// onboarding form.
export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // At least one of phone/email is required (checked in the service, since
  // class-validator can't express "either of these two" cleanly) - it's how
  // the student is found and matched to their own account if/when they log
  // in themselves later.
  @ValidateIf((dto) => !dto.email)
  @IsString()
  @MinLength(1)
  phone?: string;

  @ValidateIf((dto) => !dto.phone)
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
