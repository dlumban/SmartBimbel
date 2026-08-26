import { AdminShell } from "../src/components/AdminShell";
import { AnalyticsDashboard } from "../src/components/AnalyticsDashboard";

export default function AdminHomePage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Analitik</h1>
      <AnalyticsDashboard />
    </AdminShell>
  );
}
