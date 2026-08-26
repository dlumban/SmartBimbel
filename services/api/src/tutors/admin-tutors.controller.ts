import { BadRequestException, Body, Controller, Get, Param, Patch, Res, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import type { Response } from "express";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { TutorsService, DocumentType } from "./tutors.service";
import { VerifyTutorDto } from "./dto/verify-tutor.dto";

function assertValidDocumentType(type: string): asserts type is DocumentType {
  if (type !== "ktp" && type !== "diploma") {
    throw new BadRequestException(`Unknown document type: ${type}`);
  }
}

/**
 * Tutor approval workflow (Task 7.2) - real admin-panel screen, open to
 * either admin sub-role (approving a tutor profile isn't a financial
 * action, per PRD §5's Support/Super-Admin split). Formalizes the
 * Task 1.6 stopgap this replaces.
 */
@Controller("internal/tutors")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminTutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get("pending")
  listPending() {
    return this.tutorsService.listPendingReview();
  }

  @Patch(":id/verification")
  verify(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: VerifyTutorDto) {
    return this.tutorsService.verify(admin, id, dto);
  }

  @Get(":id/documents/:type")
  async getDocument(
    @Param("id") id: string,
    @Param("type") type: string,
    @Res() res: Response,
  ) {
    assertValidDocumentType(type);
    const buffer = await this.tutorsService.getDocumentForReview(id, type);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  }
}
