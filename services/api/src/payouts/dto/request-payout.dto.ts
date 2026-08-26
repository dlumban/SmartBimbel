import { IsInt, Min } from "class-validator";

export class RequestPayoutDto {
  @IsInt()
  @Min(1)
  amount!: number;
}
