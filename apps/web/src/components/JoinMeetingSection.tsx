"use client";

import Link from "next/link";
import { Button } from "@smartbimbel/ui";
import { JOIN_MEETING_HIGHLIGHT_MINUTES_BEFORE } from "@smartbimbel/shared";
import { Booking } from "../lib/bookings";

/**
 * "Join Meeting" / "Open in Maps" (Task 6.2) - replaces the old read-only
 * meeting-info summary on the booking detail screen. The button is always
 * clickable once a link/address exists (never a dead button per the
 * task's AC); it just becomes visually prominent as the session
 * approaches, rather than being disabled/enabled outright - a slightly
 * early or late join should never be blocked by the UI.
 */
export function JoinMeetingSection({ booking, bookingId }: { booking: Booking; bookingId: string }) {
  const isOnline = booking.mode === "ONLINE";
  const target = isOnline ? booking.meetingLink : booking.meetingAddress;

  if (!target) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-input p-4">
        <p className="text-sm text-muted-foreground">
          {isOnline ? "Belum ada link pertemuan." : "Belum ada alamat pertemuan."}
        </p>
        <Link href={`/bookings/${bookingId}/chat`} className="text-sm text-primary hover:underline">
          Atur melalui obrolan
        </Link>
      </div>
    );
  }

  const startMs = new Date(booking.scheduledAt).getTime();
  const endMs = startMs + booking.durationMinutes * 60 * 1000;
  const nowMs = Date.now();
  const isNear =
    nowMs >= startMs - JOIN_MEETING_HIGHLIGHT_MINUTES_BEFORE * 60 * 1000 && nowMs <= endMs;

  if (isOnline) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Link Pertemuan</h2>
        <a href={target} target="_blank" rel="noreferrer">
          <Button variant={isNear ? "primary" : "secondary"} className="w-full">
            Gabung Sesi
          </Button>
        </a>
        {isNear && <p className="text-xs text-success-700">Sesi akan/sedang berlangsung.</p>}
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Alamat Pertemuan</h2>
      <p className="text-sm text-foreground">{target}</p>
      <a href={mapsUrl} target="_blank" rel="noreferrer">
        <Button variant={isNear ? "primary" : "secondary"} className="w-full">
          Buka di Peta
        </Button>
      </a>
    </div>
  );
}
