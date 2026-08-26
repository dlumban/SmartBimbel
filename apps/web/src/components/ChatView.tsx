"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { Booking, getBooking } from "../lib/bookings";
import { ChatPanel } from "./ChatPanel";
import { MeetingInfoSection } from "./MeetingInfoSection";
import { ChatModerationBar } from "./ChatModerationBar";

export function ChatView({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    getBooking(bookingId)
      .then(setBooking)
      .catch(() => setLoadError("Gagal memuat booking."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [bookingId]);

  if (loading) return <LoadingSpinner />;
  if (loadError || !booking) {
    return <ErrorState description={loadError ?? "Booking tidak ditemukan."} onRetry={refresh} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 py-10">
      <Link href={`/bookings/${bookingId}`} className="text-sm text-primary hover:underline">
        &larr; Kembali ke detail booking
      </Link>
      <h1 className="text-lg font-semibold">{booking.subject.name}</h1>

      <MeetingInfoSection booking={booking} onUpdated={setBooking} />
      <ChatPanel bookingId={bookingId} />
      <ChatModerationBar />
    </div>
  );
}
