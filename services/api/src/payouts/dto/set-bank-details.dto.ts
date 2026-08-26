import { IsString, MinLength } from "class-validator";

export class SetBankDetailsDto {
  @IsString()
  @MinLength(1)
  bankName!: string;

  @IsString()
  @MinLength(1)
  bankAccountNumber!: string;

  @IsString()
  @MinLength(1)
  bankAccountHolderName!: string;
}
