import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AccessLinksService } from "./access-links.service";
import { RedeemAccessLinkDto } from "./dto/redeem-access-link.dto";

// Deliberately unguarded - redeeming a link is how someone with no
// Firebase account yet gets one, so there's nothing to authenticate first.
@Controller("auth/access-link")
export class AccessLinkRedeemController {
  constructor(private readonly accessLinksService: AccessLinksService) {}

  @Post("redeem")
  // Same reasoning as POST /auth/session's throttle - this is an
  // unauthenticated endpoint that hands out a real sign-in token.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  redeem(@Body() dto: RedeemAccessLinkDto) {
    return this.accessLinksService.redeem(dto.token);
  }
}
