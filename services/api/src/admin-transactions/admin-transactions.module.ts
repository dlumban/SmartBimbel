import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminTransactionsController } from "./admin-transactions.controller";
import { AdminTransactionsService } from "./admin-transactions.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminTransactionsController],
  providers: [AdminTransactionsService],
})
export class AdminTransactionsModule {}
