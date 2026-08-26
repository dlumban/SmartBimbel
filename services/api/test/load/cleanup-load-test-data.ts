import { PrismaClient } from "@prisma/client";

// Removes everything k6-booking-create.js's setup() and iterations
// create (firebaseUid prefix "e2e-pw-k6-") - run after a load test, the
// same way the Jest e2e specs clean up their own fixtures in afterAll.
async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { startsWith: "e2e-pw-k6-" } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) {
      // eslint-disable-next-line no-console
      console.log("No load-test data found - nothing to clean up.");
      return;
    }

    const students = await prisma.studentProfile.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);

    await prisma.bookingStatusHistory.deleteMany({ where: { booking: { studentId: { in: studentIds } } } });
    await prisma.conversation.deleteMany({ where: { booking: { studentId: { in: studentIds } } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.booking.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // eslint-disable-next-line no-console
    console.log(`Cleaned up ${userIds.length} load-test users and their bookings.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
