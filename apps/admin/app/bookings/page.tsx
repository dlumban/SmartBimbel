import { AdminShell } from "../../src/components/AdminShell";
import { BookingsManagement } from "../../src/components/BookingsManagement";

export default function BookingsPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Manajemen Booking</h1>
      <BookingsManagement />
    </AdminShell>
  );
}
