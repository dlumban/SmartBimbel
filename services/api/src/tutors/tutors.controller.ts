import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { TutorsService, DocumentType } from "./tutors.service";
import { UpsertTutorProfileDto } from "./dto/upsert-tutor-profile.dto";
import { SearchTutorsDto } from "./dto/search-tutors.dto";

const ALLOWED_DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

function assertValidDocumentType(type: string): asserts type is DocumentType {
  if (type !== "ktp" && type !== "diploma") {
    throw new BadRequestException(`Unknown document type: ${type}`);
  }
}

/**
 * Guards are applied per-method (not at class level) because this
 * controller mixes public discovery routes (list/detail, Tasks 2.2-2.4)
 * with tutor-only self-service routes (Task 1.5/1.6). Literal-path routes
 * ("me", "profile/submit", ...) are declared before the generic ":id"
 * route so Express/Nest's route matching doesn't treat "me" as an :id.
 */
@Controller("tutors")
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Put("profile")
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles("TUTOR")
  upsertProfile(@CurrentUser() user: User, @Body() dto: UpsertTutorProfileDto) {
    return this.tutorsService.upsertProfile(user, dto);
  }

  @Get("me")
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles("TUTOR")
  getMyProfile(@CurrentUser() user: User) {
    return this.tutorsService.getMyProfile(user);
  }

  @Post("profile/submit")
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles("TUTOR")
  submitForReview(@CurrentUser() user: User) {
    return this.tutorsService.submitForReview(user);
  }

  @Post("me/documents/:type")
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles("TUTOR")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
    }),
  )
  async uploadDocument(
    @CurrentUser() user: User,
    @Param("type") type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertValidDocumentType(type);
    if (!file) {
      throw new BadRequestException("No file was uploaded.");
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_DOCUMENT_MIME_TYPES.join(", ")}`,
      );
    }
    const profile = await this.tutorsService.uploadDocument(user, type, file);
    return { ok: true, tutorProfileId: profile.id };
  }

  @Get("me/documents/:type")
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles("TUTOR")
  async getDocument(
    @CurrentUser() user: User,
    @Param("type") type: string,
    @Res() res: Response,
  ) {
    assertValidDocumentType(type);
    const buffer = await this.tutorsService.getDocument(user, type);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  }

  // --- Public discovery routes (Tasks 2.2-2.4) - no guard ---

  @Get()
  search(@Query() query: SearchTutorsDto) {
    return this.tutorsService.search(query);
  }

  @Get(":id")
  getPublicDetail(@Param("id") id: string) {
    return this.tutorsService.getPublicDetail(id);
  }

  // Public - a prospective student needs this to render a busy/free
  // calendar before booking (Task: half-hour scheduling replaces
  // declared availability). Distinct path segment count from ":id" above,
  // so there's no route-matching ambiguity either way this is ordered.
  @Get(":id/schedule")
  getSchedule(@Param("id") id: string) {
    return this.tutorsService.getSchedule(id);
  }
}
