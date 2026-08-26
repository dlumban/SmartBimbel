"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../src/hooks/useAuth";
import { EarningsDashboard } from "../../../src/components/EarningsDashboard";

export default function EarningsDashboardPage() {
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
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-10">
      <h1 className="text-2xl font-bold">Pendapatan Saya</h1>
      <EarningsDashboard />
    </main>
  );
}
