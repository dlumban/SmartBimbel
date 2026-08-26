import { AdminShell } from "../../src/components/AdminShell";
import { PayoutsQueue } from "../../src/components/PayoutsQueue";

export default function PayoutsPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Pencairan Dana</h1>
      <PayoutsQueue />
    </AdminShell>
  );
}
