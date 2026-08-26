import { PrismaClient, TeachingMode, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS = [
  "Matematika",
  "Fisika",
  "Kimia",
  "Biologi",
  "Bahasa Inggris",
  "Bahasa Indonesia",
  "Sejarah",
  "Geografi",
  "Ekonomi",
  "Sosiologi",
  "PPKn",
  "Bahasa Mandarin",
  "UTBK/SNBT - Penalaran Matematika",
  "UTBK/SNBT - Literasi Bahasa Indonesia",
  "UTBK/SNBT - Literasi Bahasa Inggris",
  "UTBK/SNBT - Penalaran Umum",
];

// Bands, not individual grades - matches how PRD §1/§6.1.B frames segments
// ("SD – SMA students, UTBK/SNBT preparation"), not per-grade tutoring.
const GRADE_LEVELS = ["SD 1-6", "SMP 7-9", "SMA 10-12", "UTBK/SNBT"];

interface SeedTutor {
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  education: string;
  hourlyRate: number;
  teachingModes: TeachingMode[];
  city: string;
  verificationStatus: VerificationStatus;
  subjectNames: string[];
  gradeLevelNames: string[];
  rejectionReason?: string;
}

const SEED_TUTORS: SeedTutor[] = [
  {
    firebaseUid: "seed-tutor-1",
    name: "Budi Santoso",
    email: "budi.tutor@example.com",
    phone: "+6281234500002",
    bio: "Lulusan Teknik Fisika ITB, 3 tahun pengalaman mengajar UTBK.",
    education: "S1 Teknik Fisika, Institut Teknologi Bandung",
    hourlyRate: 150000,
    teachingModes: [TeachingMode.ONLINE, TeachingMode.OFFLINE],
    city: "Jakarta Selatan",
    verificationStatus: "VERIFIED",
    subjectNames: ["Matematika", "Fisika", "UTBK/SNBT - Penalaran Matematika"],
    gradeLevelNames: ["SMA 10-12", "UTBK/SNBT"],
  },
  {
    firebaseUid: "seed-tutor-2",
    name: "Sari Wulandari",
    email: "sari.tutor@example.com",
    phone: "+6281234500003",
    bio: "Pengajar Bahasa Inggris bersertifikat TOEFL/IELTS.",
    education: "S1 Sastra Inggris, Universitas Padjadjaran",
    hourlyRate: 120000,
    teachingModes: [TeachingMode.ONLINE],
    city: "Bandung",
    verificationStatus: "VERIFIED",
    subjectNames: ["Bahasa Inggris", "UTBK/SNBT - Literasi Bahasa Inggris"],
    gradeLevelNames: ["SMP 7-9", "SMA 10-12"],
  },
  {
    firebaseUid: "seed-tutor-3",
    name: "Andi Wijaya",
    email: "andi.tutor@example.com",
    phone: "+6281234500004",
    bio: "Guru kimia dan biologi SMA berpengalaman 5 tahun.",
    education: "S1 Pendidikan Kimia, Universitas Negeri Surabaya",
    hourlyRate: 100000,
    teachingModes: [TeachingMode.OFFLINE],
    city: "Surabaya",
    verificationStatus: "VERIFIED",
    subjectNames: ["Kimia", "Biologi"],
    gradeLevelNames: ["SMA 10-12"],
  },
  {
    firebaseUid: "seed-tutor-4",
    name: "Rina Kusuma",
    email: "rina.tutor@example.com",
    phone: "+6281234500005",
    bio: "Spesialis matematika dasar untuk siswa SD.",
    education: "S1 PGSD, Universitas Negeri Jakarta",
    hourlyRate: 80000,
    teachingModes: [TeachingMode.ONLINE, TeachingMode.OFFLINE],
    city: "Jakarta Selatan",
    verificationStatus: "VERIFIED",
    subjectNames: ["Matematika"],
    gradeLevelNames: ["SD 1-6"],
  },
  {
    firebaseUid: "seed-tutor-5",
    name: "Tono Pratama",
    email: "tono.tutor@example.com",
    phone: "+6281234500006",
    bio: "Baru mendaftar, masih menunggu verifikasi.",
    education: "S1 Matematika, Universitas Gadjah Mada",
    hourlyRate: 90000,
    teachingModes: [TeachingMode.ONLINE],
    city: "Yogyakarta",
    verificationStatus: "PENDING",
    subjectNames: ["Matematika"],
    gradeLevelNames: ["SMP 7-9"],
  },
  {
    firebaseUid: "seed-tutor-6",
    name: "Dewi Lestari",
    email: "dewi.tutor@example.com",
    phone: "+6281234500007",
    bio: "Profil ditolak - dokumen tidak lengkap.",
    education: "S1 Ekonomi, Universitas Sumatera Utara",
    hourlyRate: 95000,
    teachingModes: [TeachingMode.ONLINE],
    city: "Medan",
    verificationStatus: "REJECTED",
    subjectNames: ["Ekonomi"],
    gradeLevelNames: ["SMA 10-12"],
    rejectionReason: "Foto KTP tidak terbaca.",
  },
];

async function main() {
  // Clean up grade levels from earlier seed iterations that aren't in the
  // finalized list (e.g. Sprint 0's split "SD 1-3"/"SD 4-6") - safe as
  // long as nothing references them, which nothing does at this point.
  await prisma.gradeLevel.deleteMany({ where: { name: { notIn: GRADE_LEVELS } } });

  const subjects = await Promise.all(
    SUBJECTS.map((name) =>
      prisma.subject.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  const gradeLevels = await Promise.all(
    GRADE_LEVELS.map((name) =>
      prisma.gradeLevel.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  const student = await prisma.user.upsert({
    where: { firebaseUid: "seed-student-1" },
    // update mirrors create - re-running the seed against a DB that already
    // has these rows (from an earlier seed, before a field like `name` was
    // added) must actually apply the current field values, not just leave
    // stale rows untouched.
    update: { role: "STUDENT", name: "Andi Nugraha", phone: "+6281234500001" },
    create: {
      role: "STUDENT",
      name: "Andi Nugraha",
      phone: "+6281234500001",
      email: "andi.student@example.com",
      firebaseUid: "seed-student-1",
      studentProfile: {
        create: {
          gradeLevelId: gradeLevels.find((g) => g.name === "SMA 10-12")!.id,
          preferredLocation: "Jakarta Selatan",
          preferredMode: TeachingMode.ONLINE,
          subjectsOfInterest: {
            connect: subjects
              .filter((s) => ["Matematika", "Bahasa Inggris"].includes(s.name))
              .map((s) => ({ id: s.id })),
          },
        },
      },
    },
  });

  for (const t of SEED_TUTORS) {
    const user = await prisma.user.upsert({
      where: { firebaseUid: t.firebaseUid },
      update: { role: "TUTOR", name: t.name, phone: t.phone },
      create: {
        role: "TUTOR",
        name: t.name,
        phone: t.phone,
        email: t.email,
        firebaseUid: t.firebaseUid,
      },
    });

    const profileFields = {
      bio: t.bio,
      education: t.education,
      hourlyRate: t.hourlyRate,
      teachingModes: t.teachingModes,
      city: t.city,
      verificationStatus: t.verificationStatus,
      profileSubmittedAt: new Date(),
      rejectionReason: t.rejectionReason ?? null,
      ktpDocumentPath: "seed/ktp-placeholder.jpg",
    };
    const subjectConnections = subjects
      .filter((s) => t.subjectNames.includes(s.name))
      .map((s) => ({ id: s.id }));
    const gradeLevelConnections = gradeLevels
      .filter((g) => t.gradeLevelNames.includes(g.name))
      .map((g) => ({ id: g.id }));

    await prisma.tutorProfile.upsert({
      where: { userId: user.id },
      update: {
        ...profileFields,
        subjects: { set: subjectConnections },
        gradeLevels: { set: gradeLevelConnections },
      },
      create: {
        userId: user.id,
        ...profileFields,
        subjects: { connect: subjectConnections },
        gradeLevels: { connect: gradeLevelConnections },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded:", {
    subjects: subjects.length,
    gradeLevels: gradeLevels.length,
    student: student.email,
    tutors: SEED_TUTORS.length,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
