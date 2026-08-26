import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { TransactionStatus } from "@prisma/client";

const STATUSES: TransactionStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

export class ListTransactionsDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
