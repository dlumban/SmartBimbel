import { AdminShell } from "../../src/components/AdminShell";
import { DisputesQueue } from "../../src/components/DisputesQueue";

export default function DisputesPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Sengketa &amp; Laporan</h1>
      <DisputesQueue />
    </AdminShell>
  );
}
