import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface UserSummary {
  id: string;
  name: string | null;
  role: string | null;
  // Meaningful only when role === "ADMIN" (Task 7.1) - apps/admin reads
  // this to gate Super-Admin-only UI actions client-side; the real
  // enforcement is always server-side (AdminRoleGuard).
  adminRole: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  hasProfile: boolean;
  whatsappOptOut: boolean;
}

/**
 * Plain function rather than an injectable service so both AuthModule and
 * UsersModule can use it without an import cycle (UsersModule already
 * depends on AuthModule for its guards).
 */
export async function toUserSummary(
  prisma: PrismaService,
  user: User,
): Promise<UserSummary> {
  const [studentProfile, tutorProfile] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.tutorProfile.findUnique({ where: { userId: user.id } }),
  ]);

  // Student profiles are created atomically in one call, so the row
  // existing IS "complete". Tutor profiles are built up across a 4-step
  // wizard (Task 1.5) - the row exists from step 1 onward, so "complete"
  // has to mean "submitted for review" (profileSubmittedAt set), not just
  // "row exists". Otherwise a tutor who closes the app after step 1 would
  // get routed away from the onboarding form they haven't finished.
  const hasProfile = Boolean(studentProfile) || Boolean(tutorProfile?.profileSubmittedAt);

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    adminRole: user.adminRole,
    phone: user.phone,
    email: user.email,
    status: user.status,
    hasProfile,
    whatsappOptOut: user.whatsappOptOut,
  };
}
