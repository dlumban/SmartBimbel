import { Controller, Get, UseGuards } from "@nestjs/common";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PackagesService } from "./packages.service";

// Tutor-facing read (ScheduleSessionForm's package selector) - kept
// separate from the admin CRUD controller above since this one is
// TUTOR-only and cached, whereas the admin controller has neither concern.
@Controller("packages")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("TUTOR")
export class PackagesPublicController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  listActive() {
    return this.packagesService.listActive();
  }
}
