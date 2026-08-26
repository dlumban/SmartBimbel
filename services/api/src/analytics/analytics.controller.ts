import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

@Controller("internal/analytics")
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  summary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.summary(query);
  }

  @Get("cities")
  cities(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.cityBreakdown(query);
  }
}
