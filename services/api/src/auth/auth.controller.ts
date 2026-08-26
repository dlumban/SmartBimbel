import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { ExchangeTokenDto } from "./dto/exchange-token.dto";
import { PrismaService } from "../prisma/prisma.service";
import { toUserSummary } from "../users/user-summary";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("session")
  // Tighter than the global default - this endpoint upserts a DB row per
  // call and is the entry point for every login, so it's the most
  // attractive target for abuse/brute-forcing.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createSession(@Body() dto: ExchangeTokenDto) {
    const user = await this.authService.exchangeToken(dto.idToken);
    return toUserSummary(this.prisma, user);
  }
}
