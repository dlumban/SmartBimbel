import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { DeclineBookingDto } from "./dto/decline-booking.dto";
import { CounterProposeBookingDto } from "./dto/counter-propose-booking.dto";
import { ProposeRescheduleDto } from "./dto/propose-reschedule.dto";
import { CancelBookingDto } from "./dto/cancel-booking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";
import { SetMeetingDto } from "./dto/set-meeting.dto";
import { AddSessionNotesDto } from "./dto/add-session-notes.dto";
import { ListBookingsDto } from "./dto/list-bookings.dto";

@Controller("bookings")
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // A STUDENT creates a booking by picking a tutor (dto.tutorId); a TUTOR
  // creates one by picking a student (dto.studentId) - which field is
  // required for which role is validated in the service.
  @Post()
  @Roles("STUDENT", "TUTOR")
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user, dto);
  }

  @Get()
  findMany(@CurrentUser() user: User, @Query() query: ListBookingsDto) {
    return this.bookingsService.findMany(user, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.findOne(user, id);
  }

  @Get(":id/history")
  history(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.history(user, id);
  }

  // Open to both TUTOR (responding to a REQUESTED booking) and STUDENT
  // (responding to a tutor's counter-offer) - which action is legal for
  // which role/state is enforced by the state machine in the service, not
  // by role gating here.
  @Patch(":id/accept")
  accept(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.accept(user, id);
  }

  @Patch(":id/decline")
  decline(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: DeclineBookingDto) {
    return this.bookingsService.decline(user, id, dto);
  }

  // TUTOR-only: a tutor-initiated booking needs no counter-offer step at
  // all (it's created directly as ACCEPTED, no approval needed), so the
  // only way a REQUESTED booking exists is a student's own request - only
  // the tutor ever counter-offers one.
  @Patch(":id/counter-propose")
  @Roles("TUTOR")
  counterPropose(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CounterProposeBookingDto,
  ) {
    return this.bookingsService.counterPropose(user, id, dto);
  }

  // Either party can propose (ACCEPTED -> RESCHEDULE_PROPOSED); the service
  // then requires the *other* party to accept/decline it below.
  @Patch(":id/reschedule")
  proposeReschedule(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ProposeRescheduleDto,
  ) {
    return this.bookingsService.proposeReschedule(user, id, dto);
  }

  @Patch(":id/reschedule/accept")
  acceptReschedule(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.respondToReschedule(user, id, "reschedule-accept");
  }

  @Patch(":id/reschedule/decline")
  declineReschedule(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.respondToReschedule(user, id, "reschedule-decline");
  }

  // TUTOR-only direct edit, no counterparty approval - only legal for a
  // CONFIRMED booking the tutor scheduled themselves (enforced in the
  // service). A bare ":id" segment, so it never conflicts with the
  // ":id/<subpath>" routes above/below regardless of declaration order.
  @Patch(":id")
  @Roles("TUTOR")
  edit(@CurrentUser() tutor: User, @Param("id") id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.editForTutor(tutor, id, dto);
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: CancelBookingDto) {
    return this.bookingsService.cancel(user, id, dto);
  }

  // Tutor soft-delete: removes the session from calendars (keeps the DB row).
  @Delete(":id")
  @Roles("TUTOR")
  softDelete(@CurrentUser() tutor: User, @Param("id") id: string) {
    return this.bookingsService.softDelete(tutor, id);
  }

  @Patch(":id/no-show")
  reportNoShow(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.reportNoShow(user, id);
  }

  @Patch(":id/meeting")
  setMeeting(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: SetMeetingDto) {
    return this.bookingsService.setMeetingInfo(user, id, dto);
  }

  @Patch(":id/complete")
  complete(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.complete(user, id);
  }

  @Patch(":id/notes")
  addNotes(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: AddSessionNotesDto) {
    return this.bookingsService.addNotes(user, id, dto);
  }

  // Tutor-only (enforced in the service, same as addNotes above): uploads
  // an image to embed inline in the session notes text.
  @Post(":id/attachments/image")
  @UseInterceptors(FileInterceptor("file"))
  uploadImage(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.bookingsService.uploadImage(user, id, file);
  }

  // Tutor-only: uploads a standalone document attached to the session
  // report, distinct from an inline image.
  @Post(":id/attachments/document")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.bookingsService.uploadDocument(user, id, file);
  }

  // Either participant - lists this booking's standalone document
  // attachments (not inline images, which live inside the notes HTML).
  @Get(":id/attachments")
  listAttachments(@CurrentUser() user: User, @Param("id") id: string) {
    return this.bookingsService.listAttachments(user, id);
  }

  // Either participant - raw bytes for one attachment, used both for
  // downloading a document and for the frontend's inline-image hydration
  // (see hydrateAttachmentImages.ts).
  @Get(":id/attachments/:attachmentId")
  async getAttachment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType, filename } = await this.bookingsService.getAttachmentFile(
      user,
      id,
      attachmentId,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }

  @Delete(":id/attachments/:attachmentId")
  deleteAttachment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.bookingsService.deleteAttachment(user, id, attachmentId);
  }
}
