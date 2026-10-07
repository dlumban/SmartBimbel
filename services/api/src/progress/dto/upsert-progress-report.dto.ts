import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpsertProgressReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  topicsCovered!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  strengths?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  areasToImprove?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nextGoals?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallScore?: number;
}
