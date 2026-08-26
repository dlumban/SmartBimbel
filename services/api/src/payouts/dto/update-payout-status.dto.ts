import { IsIn, IsOptional, IsString } from "class-validator";
import { PayoutStatus } from "@prisma/client";

const NEXT_STATUSES: PayoutStatus[] = ["PROCESSING", "COMPLETED", "FAILED"];

export class UpdatePayoutStatusDto {
  @IsIn(NEXT_STATUSES)
  status!: PayoutStatus;

  @IsOptional()
  @IsString()
  failureReason?: string;
}
