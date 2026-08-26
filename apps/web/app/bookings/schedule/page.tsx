"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../src/hooks/useAuth";
import { ScheduleSessionForm } from "../../../src/components/ScheduleSessionForm";

export default function ScheduleSessionPage() {
  const { sessionUser, loading } = useAuth();
  const router = useRouter();

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

  if (loading || !sessionUser || sessionUser.role !== "TUTOR") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <ScheduleSessionForm />
    </main>
  );
}
