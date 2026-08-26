import { AdminShell } from "../../../src/components/AdminShell";
import { BookingsCalendar } from "../../../src/components/BookingsCalendar";

export default function BookingsCalendarPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Kalender Sesi</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Semua sesi dari seluruh tutor dan siswa. Klik sesi untuk melihat detail, laporan, dan
        riwayat.
      </p>
      <BookingsCalendar />
    </AdminShell>
  );
}
