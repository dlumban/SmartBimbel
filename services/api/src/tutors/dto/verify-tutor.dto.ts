import { IsIn, IsString, MinLength, ValidateIf } from "class-validator";

export class VerifyTutorDto {
  @IsIn(["VERIFIED", "REJECTED"])
  status!: "VERIFIED" | "REJECTED";

  // Required when rejecting (the tutor needs to know why), ignored otherwise.
  @ValidateIf((o) => o.status === "REJECTED")
  @IsString()
  @MinLength(1)
  reason?: string;
}
