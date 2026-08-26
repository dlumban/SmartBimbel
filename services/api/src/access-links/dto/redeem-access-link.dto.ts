import { IsString, MinLength } from "class-validator";

export class RedeemAccessLinkDto {
  @IsString()
  @MinLength(1)
  token!: string;
}
