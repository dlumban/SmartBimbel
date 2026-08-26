"use client";

import { useState } from "react";
import { Button } from "@smartbimbel/ui";
import { Booking, completeBooking } from "../lib/bookings";

/**
 * Manual "Tandai Selesai" (Task 6.1) - tutor-only, only enabled once the
 * session's scheduled end time has passed. An unmarked session still
 * auto-completes later via the backend's grace-period safety net, so
 * this is a convenience for prompt completion, not the only path to
 * COMPLETED.
 */
export function SessionCompletionSection({
  booking,
  onUpdated,
}: {
  booking: Booking;
  onUpdated: (booking: Booking) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduledEnd = new Date(booking.scheduledAt).getTime() + booking.durationMinutes * 60 * 1000;
  const hasOccurred = scheduledEnd <= Date.now();

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      onUpdated(await completeBooking(booking.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menandai sesi selesai.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        {hasOccurred
          ? "Sesi telah berlangsung. Tandai selesai untuk membuka kelayakan pencairan dana dan ulasan siswa."
          : "Tombol ini akan aktif setelah waktu sesi berakhir."}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button disabled={submitting || !hasOccurred} onClick={handleComplete}>
        Tandai Selesai
      </Button>
    </div>
  );
}
