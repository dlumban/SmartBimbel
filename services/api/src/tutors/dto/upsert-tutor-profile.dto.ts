import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";

export class UpsertTutorProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  hourlyRate?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(["ONLINE", "OFFLINE"], { each: true })
  teachingModes?: ("ONLINE" | "OFFLINE")[];

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  gradeLevelIds?: string[];
}
