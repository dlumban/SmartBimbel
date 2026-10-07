import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertProgressReportDto } from "./dto/upsert-progress-report.dto";
import { CreateHomeworkDto, ReviewHomeworkDto, SubmitHomeworkDto } from "./dto/homework.dto";

const BOOKING_PARTICIPANTS = {
  student: true,
  tutor: true,
} as const;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadBooking(user: User, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_PARTICIPANTS,
    });
    if (!booking || booking.deletedAt) {
      throw new NotFoundException("No booking with that id exists.");
    }
    const isStudent = booking.student.userId === user.id;
    const isTutor = booking.tutor.userId === user.id;
    if (!isStudent && !isTutor) {
      throw new ForbiddenException("You are not a participant in this booking.");
    }
    return { booking, isStudent, isTutor };
  }

  async getProgressReport(user: User, bookingId: string) {
    await this.loadBooking(user, bookingId);
    return this.prisma.progressReport.findUnique({ where: { bookingId } });
  }

  async upsertProgressReport(user: User, bookingId: string, dto: UpsertProgressReportDto) {
    const { isTutor } = await this.loadBooking(user, bookingId);
    if (!isTutor) {
      throw new ForbiddenException("Only the tutor can write a progress report.");
    }
    return this.prisma.progressReport.upsert({
      where: { bookingId },
      create: {
        bookingId,
        topicsCovered: dto.topicsCovered,
        strengths: dto.strengths,
        areasToImprove: dto.areasToImprove,
        nextGoals: dto.nextGoals,
        overallScore: dto.overallScore,
        createdByUserId: user.id,
      },
      update: {
        topicsCovered: dto.topicsCovered,
        strengths: dto.strengths,
        areasToImprove: dto.areasToImprove,
        nextGoals: dto.nextGoals,
        overallScore: dto.overallScore,
      },
    });
  }

  async listHomework(user: User, bookingId: string) {
    const { booking } = await this.loadBooking(user, bookingId);
    return this.prisma.homeworkAssignment.findMany({
      where: { bookingId },
      include: {
        submissions: {
          where: user.role === "STUDENT" ? { studentId: booking.studentId } : undefined,
          include: { student: { include: { user: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createHomework(user: User, bookingId: string, dto: CreateHomeworkDto) {
    const { isTutor } = await this.loadBooking(user, bookingId);
    if (!isTutor) {
      throw new ForbiddenException("Only the tutor can assign homework.");
    }
    return this.prisma.homeworkAssignment.create({
      data: {
        bookingId,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      include: { submissions: true },
    });
  }

  async submitHomework(user: User, assignmentId: string, dto: SubmitHomeworkDto) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: { booking: { include: BOOKING_PARTICIPANTS } },
    });
    if (!assignment || assignment.booking.deletedAt) {
      throw new NotFoundException("No homework assignment with that id exists.");
    }
    if (assignment.booking.student.userId !== user.id) {
      throw new ForbiddenException("Only the student on this booking can submit homework.");
    }
    if (!dto.content?.trim()) {
      throw new BadRequestException("content is required when submitting homework.");
    }

    const submission = await this.prisma.homeworkSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: assignment.booking.studentId,
        },
      },
      create: {
        assignmentId,
        studentId: assignment.booking.studentId,
        content: dto.content,
      },
      update: {
        content: dto.content,
        submittedAt: new Date(),
        tutorFeedback: null,
        reviewedAt: null,
      },
    });

    await this.prisma.homeworkAssignment.update({
      where: { id: assignmentId },
      data: { status: "SUBMITTED" },
    });

    return submission;
  }

  async reviewHomework(user: User, assignmentId: string, dto: ReviewHomeworkDto) {
    const assignment = await this.prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: { booking: { include: BOOKING_PARTICIPANTS }, submissions: true },
    });
    if (!assignment || assignment.booking.deletedAt) {
      throw new NotFoundException("No homework assignment with that id exists.");
    }
    if (assignment.booking.tutor.userId !== user.id) {
      throw new ForbiddenException("Only the tutor can review homework.");
    }
    const submission = assignment.submissions[0];
    if (!submission) {
      throw new BadRequestException("No submission to review yet.");
    }

    await this.prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        tutorFeedback: dto.tutorFeedback,
        reviewedAt: new Date(),
      },
    });

    return this.prisma.homeworkAssignment.update({
      where: { id: assignmentId },
      data: { status: "REVIEWED" },
      include: {
        submissions: { include: { student: { include: { user: true } } } },
      },
    });
  }
}
