import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { BookingListBucket } from "@smartbimbel/shared";

const BUCKETS: BookingListBucket[] = ["upcoming", "past", "cancelled"];

export class ListBookingsDto {
  @IsOptional()
  @IsIn(BUCKETS)
  bucket?: BookingListBucket;

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
}
