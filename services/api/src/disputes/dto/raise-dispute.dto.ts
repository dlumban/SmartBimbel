import { IsString, MaxLength, MinLength } from "class-validator";

export class RaiseDisputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
