import { IsString, Matches } from "class-validator";

export class ProposeRescheduleDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "proposedDate must be an ISO date (YYYY-MM-DD)" })
  proposedDate!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "proposedTime must be HH:mm" })
  proposedTime!: string;
}
