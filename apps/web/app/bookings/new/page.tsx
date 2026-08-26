"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../src/hooks/useAuth";
import { NewBookingForm } from "../../../src/components/NewBookingForm";

function NewBookingContent() {
  const searchParams = useSearchParams();
  const tutorId = searchParams.get("tutorId");
  const { sessionUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) {
      router.replace("/login");
      return;
    }
    if (sessionUser.role !== "STUDENT") {
      router.replace("/");
    }
  }, [loading, sessionUser, router]);

  if (loading || !sessionUser || sessionUser.role !== "STUDENT") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <NewBookingForm tutorId={tutorId} />
    </main>
  );
}

export default function NewBookingPage() {
  return (
    // useSearchParams() opts the page out of static rendering unless
    // wrapped in Suspense - without this, `next build`'s static export of
    // this page fails outright (caught via a real build error, not a guess).
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <LoadingSpinner />
        </main>
      }
    >
      <NewBookingContent />
    </Suspense>
  );
}
