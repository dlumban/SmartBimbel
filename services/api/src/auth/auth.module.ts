import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { FirebaseAdminService } from "./firebase-admin.service";
import { FirebaseAuthGuard } from "./guards/firebase-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { AdminRoleGuard } from "./guards/admin-role.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, FirebaseAdminService, FirebaseAuthGuard, RolesGuard, AdminRoleGuard],
  exports: [FirebaseAdminService, FirebaseAuthGuard, RolesGuard, AdminRoleGuard],
})
export class AuthModule {}
