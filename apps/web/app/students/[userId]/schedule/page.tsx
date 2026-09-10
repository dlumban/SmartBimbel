"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../../src/hooks/useAuth";
import { StudentScheduleList } from "../../../../src/components/StudentScheduleList";

export default function StudentSchedulePage() {
  const { sessionUser, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentUserId = typeof params.userId === "string" ? params.userId : "";

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) {
      router.replace("/login");
      return;
    }
    if (sessionUser.role !== "TUTOR") {
      router.replace("/");
    }
  }, [loading, sessionUser, router]);

  if (loading || !sessionUser || sessionUser.role !== "TUTOR" || !studentUserId) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <StudentScheduleList studentUserId={studentUserId} />
    </main>
  );
}
