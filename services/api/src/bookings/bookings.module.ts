import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatModule } from "../chat/chat.module";
import { PaymentsModule } from "../payments/payments.module";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { DailyService } from "./daily.service";
import { BookingExpiryProcessor } from "./processors/booking-expiry.processor";
import { SessionReminderProcessor } from "./processors/session-reminder.processor";
import { SessionAutoCompleteProcessor } from "./processors/session-auto-complete.processor";

@Module({
  imports: [AuthModule, JobsModule, NotificationsModule, ChatModule, PaymentsModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    DailyService,
    BookingExpiryProcessor,
    SessionReminderProcessor,
    SessionAutoCompleteProcessor,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
