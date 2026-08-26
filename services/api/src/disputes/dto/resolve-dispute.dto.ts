import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { DisputeStatus } from "@prisma/client";

const RESOLUTION_STATUSES: DisputeStatus[] = ["RESOLVED_REFUND", "RESOLVED_NO_REFUND"];

export class ResolveDisputeDto {
  @IsIn(RESOLUTION_STATUSES)
  status!: DisputeStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  // Defaults to the transaction's full paid amount when omitted (full
  // refund) - only needed to specify a partial refund.
  @IsOptional()
  @IsInt()
  @Min(1)
  refundAmount?: number;
}
