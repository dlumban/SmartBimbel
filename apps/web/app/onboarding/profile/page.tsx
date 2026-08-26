"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../src/hooks/useAuth";
import { StudentProfileForm } from "../../../src/components/StudentProfileForm";
import { TutorProfileWizard } from "../../../src/components/TutorProfileWizard";

export default function ProfileSetupPage() {
  const { sessionUser, loading, refreshSession } = useAuth();
  const router = useRouter();

  // Students onboard in one shot (StudentProfileForm), so hasProfile alone
  // is a safe "already done" signal. Tutors go through a multi-step wizard
  // that can end in REJECTED - hasProfile stays true after a rejection (the
  // profile WAS submitted), but the tutor still needs to get back into this
  // page to fix and resubmit it. TutorProfileWizard itself decides whether
  // there's anything left to do once it has loaded the real status.
  const shouldBounceAway = sessionUser?.hasProfile && sessionUser.role === "STUDENT";

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) {
      router.replace("/login");
      return;
    }
    if (!sessionUser.role) {
      router.replace("/onboarding/role");
      return;
    }
    if (shouldBounceAway) {
      router.replace("/");
    }
  }, [loading, sessionUser, shouldBounceAway, router]);

  if (loading || !sessionUser || !sessionUser.role || shouldBounceAway) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          {sessionUser.role === "TUTOR" ? "Profil Tutor" : "Lengkapi profil Anda"}
        </h1>
        {sessionUser.role === "STUDENT" && (
          <p className="mt-1 text-neutral-600">Bantu kami mencarikan tutor yang tepat untuk Anda.</p>
        )}
      </div>

      {sessionUser.role === "STUDENT" ? (
        <StudentProfileForm
          onSuccess={async () => {
            await refreshSession();
            router.replace("/");
          }}
        />
      ) : (
        <TutorProfileWizard
          onSubmitted={async () => {
            await refreshSession();
            router.replace("/");
          }}
        />
      )}
    </main>
  );
}
