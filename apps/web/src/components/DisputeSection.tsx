"use client";

import { useState } from "react";
import { Button } from "@smartbimbel/ui";
import { raiseDispute } from "../lib/disputes";

/**
 * Lets either party raise a dispute against a booking (Task 5.6) - the
 * admin review/resolution UI is explicitly out of scope here per the
 * task's own technical note (that's Sprint 7, Task 7.5); this component
 * only ever calls POST /bookings/:id/disputes.
 */
export function DisputeSection({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Jelaskan masalah yang Anda alami.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await raiseDispute(bookingId, reason);
      setSubmitted(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim sengketa.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="rounded-md bg-success-50 p-3 text-sm text-success-700">
        Sengketa Anda telah dikirim dan akan ditinjau oleh tim kami.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      {!open ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Ajukan Sengketa
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="dispute-reason">
            Jelaskan masalahnya
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="rounded-md border border-input p-2 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={submitting} onClick={handleSubmit}>
              Kirim Sengketa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
