import { AdminShell } from "../../src/components/AdminShell";
import { UsersManagement } from "../../src/components/UsersManagement";

export default function UsersPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Manajemen Pengguna</h1>
      <UsersManagement />
    </AdminShell>
  );
}
