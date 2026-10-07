import { ForbiddenException } from "@nestjs/common";
import { ProgressService } from "./progress.service";
import { PrismaService } from "../prisma/prisma.service";

function makeUser(role: "TUTOR" | "STUDENT", id = "u1") {
  return { id, role } as never;
}

describe("ProgressService", () => {
  let service: ProgressService;
  let prisma: {
    booking: { findUnique: jest.Mock };
    progressReport: { findUnique: jest.Mock; upsert: jest.Mock };
    homeworkAssignment: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    homeworkSubmission: { upsert: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      progressReport: { findUnique: jest.fn(), upsert: jest.fn() },
      homeworkAssignment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      homeworkSubmission: { upsert: jest.fn(), update: jest.fn() },
    };
    service = new ProgressService(prisma as unknown as PrismaService);
  });

  it("rejects a student writing a progress report", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      deletedAt: null,
      student: { userId: "student-1", id: "sp1" },
      tutor: { userId: "tutor-1" },
    });
    await expect(
      service.upsertProgressReport(makeUser("STUDENT", "student-1"), "b1", {
        topicsCovered: "Aljabar",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("upserts a progress report for the tutor", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      deletedAt: null,
      student: { userId: "student-1", id: "sp1" },
      tutor: { userId: "tutor-1" },
    });
    prisma.progressReport.upsert.mockResolvedValue({ id: "pr1", topicsCovered: "Aljabar" });
    const result = await service.upsertProgressReport(makeUser("TUTOR", "tutor-1"), "b1", {
      topicsCovered: "Aljabar",
      overallScore: 4,
    });
    expect(result.topicsCovered).toBe("Aljabar");
    expect(prisma.progressReport.upsert).toHaveBeenCalled();
  });

  it("marks homework REVIEWED after tutor feedback", async () => {
    prisma.homeworkAssignment.findUnique.mockResolvedValue({
      id: "hw1",
      booking: {
        deletedAt: null,
        student: { userId: "student-1", id: "sp1" },
        tutor: { userId: "tutor-1" },
      },
      submissions: [{ id: "sub1" }],
    });
    prisma.homeworkSubmission.update.mockResolvedValue({});
    prisma.homeworkAssignment.update.mockResolvedValue({ id: "hw1", status: "REVIEWED" });

    const result = await service.reviewHomework(makeUser("TUTOR", "tutor-1"), "hw1", {
      tutorFeedback: "Bagus",
    });
    expect(result.status).toBe("REVIEWED");
  });
});
