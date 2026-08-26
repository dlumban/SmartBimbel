import { AdminShell } from "../../src/components/AdminShell";
import { TransactionsView } from "../../src/components/TransactionsView";

export default function TransactionsPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Transaksi</h1>
      <TransactionsView />
    </AdminShell>
  );
}
