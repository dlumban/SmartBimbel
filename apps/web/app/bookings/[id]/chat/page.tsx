"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../../../src/hooks/useAuth";
import { ChatView } from "../../../../src/components/ChatView";

// Next.js 14 passes route params synchronously (not a Promise, unlike 15+).
export default function BookingChatPage({ params }: { params: { id: string } }) {
  const { sessionUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) {
      router.replace("/login");
    }
  }, [loading, sessionUser, router]);

  if (loading || !sessionUser) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <ChatView bookingId={params.id} />
    </main>
  );
}
