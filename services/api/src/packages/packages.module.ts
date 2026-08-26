import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { RedisModule } from "../redis/redis.module";
import { PackagesController } from "./packages.controller";
import { PackagesPublicController } from "./packages-public.controller";
import { PackagesService } from "./packages.service";

@Module({
  imports: [AuthModule, AuditLogModule, RedisModule],
  controllers: [PackagesController, PackagesPublicController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
