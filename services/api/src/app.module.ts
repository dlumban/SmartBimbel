import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { MasterDataModule } from "./master-data/master-data.module";
import { StudentsModule } from "./students/students.module";
import { StorageModule } from "./storage/storage.module";
import { TutorsModule } from "./tutors/tutors.module";
import { RedisModule } from "./redis/redis.module";
import { JobsModule } from "./jobs/jobs.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ChatModule } from "./chat/chat.module";
import { PaymentsModule } from "./payments/payments.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { DisputesModule } from "./disputes/disputes.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { AdminUsersModule } from "./admin-users/admin-users.module";
import { AdminBookingsModule } from "./admin-bookings/admin-bookings.module";
import { AdminTransactionsModule } from "./admin-transactions/admin-transactions.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AccessLinksModule } from "./access-links/access-links.module";
import { PackagesModule } from "./packages/packages.module";
import { ProgressModule } from "./progress/progress.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    StorageModule,
    JobsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MasterDataModule,
    StudentsModule,
    TutorsModule,
    BookingsModule,
    ChatModule,
    PaymentsModule,
    PayoutsModule,
    DisputesModule,
    ReviewsModule,
    AuditLogModule,
    AdminUsersModule,
    AdminBookingsModule,
    AdminTransactionsModule,
    AnalyticsModule,
    AccessLinksModule,
    PackagesModule,
    ProgressModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
