import { AdminShell } from "../../src/components/AdminShell";
import { PackagesManagement } from "../../src/components/PackagesManagement";

export default function PackagesPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Manajemen Paket Les</h1>
      <PackagesManagement />
    </AdminShell>
  );
}
