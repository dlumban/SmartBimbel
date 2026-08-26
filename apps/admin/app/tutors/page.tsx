import { AdminShell } from "../../src/components/AdminShell";
import { TutorApprovalQueue } from "../../src/components/TutorApprovalQueue";

export default function TutorsPage() {
  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-bold">Persetujuan Tutor</h1>
      <TutorApprovalQueue />
    </AdminShell>
  );
}
