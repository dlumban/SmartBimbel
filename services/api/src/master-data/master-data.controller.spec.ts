import { Test, TestingModule } from "@nestjs/testing";
import { MasterDataController } from "./master-data.controller";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

describe("MasterDataController", () => {
  let controller: MasterDataController;
  let prisma: {
    subject: { findMany: jest.Mock };
    gradeLevel: { findMany: jest.Mock };
  };
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = {
      subject: { findMany: jest.fn().mockResolvedValue([{ id: "s1", name: "Matematika" }]) },
      gradeLevel: { findMany: jest.fn().mockResolvedValue([{ id: "g1", name: "SMA 10-12" }]) },
    };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterDataController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    controller = module.get(MasterDataController);
  });

  it("queries and caches subjects on a cache miss", async () => {
    const result = await controller.subjects();
    expect(prisma.subject.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    expect(redis.set).toHaveBeenCalledWith(
      "master-data:subjects",
      [{ id: "s1", name: "Matematika" }],
      expect.any(Number),
    );
    expect(result).toEqual([{ id: "s1", name: "Matematika" }]);
  });

  it("returns the cached value without querying Postgres on a cache hit", async () => {
    redis.get.mockResolvedValue([{ id: "cached", name: "Cached Subject" }]);
    const result = await controller.subjects();
    expect(prisma.subject.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: "cached", name: "Cached Subject" }]);
  });

  it("queries and caches grade levels on a cache miss", async () => {
    const result = await controller.gradeLevels();
    expect(prisma.gradeLevel.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    expect(result).toEqual([{ id: "g1", name: "SMA 10-12" }]);
  });
});
