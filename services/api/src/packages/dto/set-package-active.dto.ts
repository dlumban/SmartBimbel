import { IsBoolean } from "class-validator";

export class SetPackageActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
