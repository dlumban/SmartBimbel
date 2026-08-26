import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { TutorsController } from "./tutors.controller";
import { AdminTutorsController } from "./admin-tutors.controller";
import { TutorsService } from "./tutors.service";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [TutorsController, AdminTutorsController],
  providers: [TutorsService],
})
export class TutorsModule {}
