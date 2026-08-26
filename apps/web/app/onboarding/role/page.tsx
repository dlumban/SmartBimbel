"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../src/hooks/useAuth";
import { RoleSelector } from "../../../src/components/RoleSelector";
import { getOnboardingRedirect } from "../../../src/lib/onboarding";

export default function RoleSelectionPage() {
  const { sessionUser, loading, refreshSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) {
      router.replace("/login");
      return;
    }
    if (sessionUser.role) {
      // Role selection is a one-time step (see PATCH /users/me/role) -
      // an already-onboarded user landing here gets routed to wherever
      // they actually belong instead of being allowed to change it.
      router.replace(getOnboardingRedirect(sessionUser) ?? "/");
    }
  }, [loading, sessionUser, router]);

  if (loading || !sessionUser || sessionUser.role) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Anda mendaftar sebagai apa?</h1>
        <p className="mt-1 text-neutral-600">Pilihan ini tidak dapat diubah sendiri nanti.</p>
      </div>
      <RoleSelector
        onSelected={async () => {
          await refreshSession();
          router.replace("/onboarding/profile");
        }}
      />
    </main>
  );
}
