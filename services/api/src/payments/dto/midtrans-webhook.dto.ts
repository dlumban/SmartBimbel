import { IsOptional, IsString } from "class-validator";

// Midtrans's notification payload has many more fields than this - only
// the ones our webhook handler actually reads are validated; the rest
// pass through untyped (Midtrans, not a user, controls this payload, so
// whitelist-stripping the rest via ValidationPipe is fine here since we
// never read them).
export class MidtransWebhookDto {
  @IsString()
  order_id!: string;

  @IsString()
  status_code!: string;

  @IsString()
  gross_amount!: string;

  @IsString()
  signature_key!: string;

  @IsString()
  transaction_status!: string;

  @IsOptional()
  @IsString()
  fraud_status?: string;

  @IsOptional()
  @IsString()
  transaction_id?: string;
}
