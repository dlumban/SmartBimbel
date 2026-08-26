import Link from "next/link";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { Button, Card, CardContent } from "@smartbimbel/ui";

// Scoped to this component only (not the global layout) - the rest of the
// app keeps the shared `font-sans` (Inter) from app/globals.css.
const heading = Space_Grotesk({ subsets: ["latin"], weight: ["600", "700"] });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"] });

const FEATURES = [
  {
    title: "Cari Tutor Terverifikasi",
    description: "Telusuri profil tutor bersertifikat sesuai mata pelajaran dan jenjang Anda.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <circle cx="11" cy="11" r="7" strokeLinecap="round" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Jadwalkan Sesi Mudah",
    description: "Pilih waktu yang cocok dan booking sesi les hanya dalam beberapa klik.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Pembayaran Aman",
    description: "Transaksi terlindungi lewat sistem pembayaran terpercaya.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <path
          d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Pantau Perkembangan",
    description: "Lihat riwayat sesi, catatan, dan rating setiap kali belajar.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <path
          d="M12 3l8 4-8 4-8-4 8-4zM4 11l8 4 8-4M4 15l8 4 8-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function LandingPage() {
  return (
    <main className={`${body.className} min-h-screen px-4 pb-16 pt-6 sm:px-6`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between pb-8">
        <span className={`${heading.className} text-lg font-semibold text-primary-700`}>
          SmartBimbel
        </span>
        <Link href="/login">
          <Button variant="secondary" size="sm">
            Masuk
          </Button>
        </Link>
      </div>

      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 via-primary-900 to-neutral-900 px-6 py-12 text-white sm:px-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-200">
          Untuk Tutor dan Siswa
        </p>
        <h1 className={`${heading.className} mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl`}>
          Temukan tutor privat terbaik, jadwalkan les dengan mudah.
        </h1>
        <p className="mt-4 max-w-xl text-base text-primary-100">
          Satu tempat untuk mencari tutor terverifikasi, booking sesi, membayar dengan aman, dan
          memantau perkembangan belajar Anda.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login">
            <Button variant="secondary" size="lg">
              Daftar Gratis
            </Button>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/30 px-6 text-lg font-medium text-white transition-colors hover:bg-white/10"
          >
            Saya Siswa
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                {feature.icon}
              </span>
              <h2 className="text-base font-semibold text-neutral-900">{feature.title}</h2>
              <p className="text-sm text-neutral-600">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mx-auto mt-12 max-w-5xl text-center text-sm text-neutral-500">
        SmartBimbel &middot; Tutor privat terpercaya di Indonesia.
      </p>
    </main>
  );
}
