import { IsIn } from "class-validator";

export class SetRoleDto {
  @IsIn(["STUDENT", "TUTOR"])
  role!: "STUDENT" | "TUTOR";
}
