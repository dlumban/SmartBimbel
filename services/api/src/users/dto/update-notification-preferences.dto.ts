import { IsBoolean } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  whatsappOptOut!: boolean;
}
