import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateHomeworkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(T[\d:.+-]+Z)?$/, {
    message: "dueAt must be an ISO date or datetime",
  })
  dueAt?: string;
}

export class SubmitHomeworkDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}

export class ReviewHomeworkDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  tutorFeedback?: string;
}
