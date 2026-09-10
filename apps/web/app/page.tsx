"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../src/hooks/useAuth";
import { getOnboardingRedirect } from "../src/lib/onboarding";
import { TutorVerificationStatus } from "../src/components/TutorVerificationStatus";
import { BookingList } from "../src/components/BookingList";
import { BookingCalendar } from "../src/components/BookingCalendar";
import { LandingPage } from "../src/components/LandingPage";

// apps/web is student/tutor-facing only - an ADMIN account has no
// student/tutor data here, so it gets pointed at the real app instead of
// an empty-looking booking list (see SiteHeader's ADMIN_URL for the menu
// equivalent).
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

export default function HomePage() {
  const { sessionUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !sessionUser) return;
    const redirect = getOnboardingRedirect(sessionUser);
    if (redirect) router.replace(redirect);
  }, [loading, sessionUser, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  if (!sessionUser) {
    return <LandingPage />;
  }

  // sessionUser is guaranteed here - the guard above redirects to /login
  // and shows the spinner otherwise.
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 pb-10 pt-2 text-center">
      <h1 className="text-2xl font-bold">Selamat datang kembali</h1>
      {sessionUser.role === "TUTOR" && (
        <Card className="w-full max-w-6xl">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <TutorVerificationStatus />
            <div className="flex w-full flex-col items-stretch gap-3">
              <BookingCalendar includeCancelled />
            </div>
          </CardContent>
        </Card>
      )}
      {sessionUser.role === "ADMIN" && (
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-2 pt-6">
            <p className="text-muted-foreground">
              Akun ini adalah akun admin dan tidak memiliki data booking di sini.
            </p>
            <a href={ADMIN_URL} className="text-primary hover:underline">
              Buka Admin Panel &rarr;
            </a>
          </CardContent>
        </Card>
      )}
      {sessionUser.role === "STUDENT" && (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Sesi Saya</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingList />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
