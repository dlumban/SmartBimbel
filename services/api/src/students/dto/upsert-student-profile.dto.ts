import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class UpsertStudentProfileDto {
  @IsString()
  gradeLevelId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  subjectIds!: string[];

  @IsOptional()
  @IsString()
  preferredLocation?: string;

  @IsOptional()
  @IsIn(["ONLINE", "OFFLINE"])
  preferredMode?: "ONLINE" | "OFFLINE";
}
