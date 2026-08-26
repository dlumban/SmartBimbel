import { ConflictException, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toUserSummary, UserSummary } from "./user-summary";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toSummary(user: User): Promise<UserSummary> {
    return toUserSummary(this.prisma, user);
  }

  /**
   * Sets a user's role exactly once. Self-service role changes after that
   * would let a tutor relabel themselves a student to dodge verification
   * (or vice versa) - any future change has to go through admin support,
   * not this endpoint.
   */
  async setRole(user: User, role: "STUDENT" | "TUTOR"): Promise<User> {
    if (user.role) {
      throw new ConflictException("Role has already been set for this account.");
    }
    return this.prisma.user.update({ where: { id: user.id }, data: { role } });
  }

  async updateName(user: User, name: string): Promise<User> {
    return this.prisma.user.update({ where: { id: user.id }, data: { name } });
  }

  async updateNotificationPreferences(user: User, whatsappOptOut: boolean): Promise<User> {
    return this.prisma.user.update({ where: { id: user.id }, data: { whatsappOptOut } });
  }
}
