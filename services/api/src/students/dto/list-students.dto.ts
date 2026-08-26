import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListStudentsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // Restricts the listing to students the requesting tutor themselves added
  // (Prisma.UserWhereInput.addedByTutorId), instead of the default global
  // pool. `@Type(() => Boolean)` can't be used here since Boolean("false")
  // is true in JS - this query param arrives as a literal "true"/"false"
  // string.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  mine?: boolean;
}
