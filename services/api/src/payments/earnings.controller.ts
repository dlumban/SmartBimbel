import { Controller, Get, Header, NotFoundException, Query, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { EarningsService } from "./earnings.service";

@Controller("tutors/me/earnings")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("TUTOR")
export class EarningsController {
  constructor(
    private readonly earnings: EarningsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getTutorProfile(user: User) {
    const tutorProfile = await this.prisma.tutorProfile.findUnique({ where: { userId: user.id } });
    if (!tutorProfile) {
      throw new NotFoundException("No tutor profile exists for this account yet.");
    }
    return tutorProfile;
  }

  @Get()
  async getSummary(@CurrentUser() user: User) {
    const tutorProfile = await this.getTutorProfile(user);
    const [summary, payouts] = await Promise.all([
      this.earnings.getBalanceSummary(tutorProfile.id),
      this.prisma.payout.findMany({
        where: { tutorId: tutorProfile.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { ...summary, payouts };
  }

  @Get("export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="earnings.csv"')
  async exportCsv(
    @CurrentUser() user: User,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    const tutorProfile = await this.getTutorProfile(user);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: "PAID",
        booking: { tutorId: tutorProfile.id },
        ...(from ? { paidAt: { gte: new Date(from) } } : {}),
        ...(to ? { paidAt: { lte: new Date(to) } } : {}),
      },
      include: { booking: { include: { student: { include: { user: true } }, subject: true } } },
      orderBy: { paidAt: "asc" },
    });

    const header = "Tanggal,Mata Pelajaran,Siswa,Bruto (IDR),Komisi (IDR),Bersih (IDR)";
    const rows = transactions.map((t) => {
      const net = t.amount - t.commission;
      const date = t.paidAt ? t.paidAt.toISOString().slice(0, 10) : "";
      const subject = t.booking.subject.name.replace(/,/g, " ");
      const student = (t.booking.student.user.name ?? "Siswa").replace(/,/g, " ");
      return `${date},${subject},${student},${t.amount},${t.commission},${net}`;
    });

    return [header, ...rows].join("\n");
  }
}
