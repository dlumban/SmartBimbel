import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns status ok with database ok when the DB is reachable", async () => {
    const result = await controller.check();
    expect(result.status).toBe("ok");
    expect(result.database).toBe("ok");
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("returns database unreachable when the query throws", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const result = await controller.check();
    expect(result.status).toBe("ok");
    expect(result.database).toBe("unreachable");
  });
});
