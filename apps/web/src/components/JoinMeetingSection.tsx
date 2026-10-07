"use client";

import Link from "next/link";
import { Button } from "@smartbimbel/ui";
import { JOIN_MEETING_HIGHLIGHT_MINUTES_BEFORE } from "@smartbimbel/shared";
import { Booking } from "../lib/bookings";

/**
 * Join Meeting / Open Maps / in-app Daily session room (Phase 2).
 * Prefers Daily room when dailyRoomUrl is present; otherwise Zoom/Meet link.
 */
export function JoinMeetingSection({ booking, bookingId }: { booking: Booking; bookingId: string }) {
  const isOnline = booking.mode === "ONLINE";
  const dailyUrl = booking.dailyRoomUrl ?? booking.group?.dailyRoomUrl ?? null;
  const externalTarget = isOnline ? booking.meetingLink : booking.meetingAddress;

  const startMs = new Date(booking.scheduledAt).getTime();
  const endMs = startMs + booking.durationMinutes * 60 * 1000;
  const nowMs = Date.now();
  const isNear =
    nowMs >= startMs - JOIN_MEETING_HIGHLIGHT_MINUTES_BEFORE * 60 * 1000 && nowMs <= endMs;

  if (isOnline && (dailyUrl || true)) {
    // Always offer in-app room attempt for ONLINE (creates Daily room on first open
    // when configured). External Zoom/Meet remains as secondary when set.
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Link Pertemuan</h2>
        <Link href={`/bookings/${bookingId}/session`}>
          <Button variant={isNear ? "primary" : "secondary"} className="w-full">
            Buka ruang sesi
          </Button>
        </Link>
        {externalTarget && (
          <a href={externalTarget} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
            Atau gabung via Zoom/Meet
          </a>
        )}
        {!externalTarget && !dailyUrl && (
          <Link href={`/bookings/${bookingId}/chat`} className="text-sm text-muted-foreground hover:underline">
            Atur link Zoom/Meet melalui obrolan
          </Link>
        )}
        {isNear && <p className="text-xs text-success-700">Sesi akan/sedang berlangsung.</p>}
      </div>
    );
  }

  if (!externalTarget) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-input p-4">
        <p className="text-sm text-muted-foreground">Belum ada alamat pertemuan.</p>
        <Link href={`/bookings/${bookingId}/chat`} className="text-sm text-primary hover:underline">
          Atur melalui obrolan
        </Link>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(externalTarget)}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Alamat Pertemuan</h2>
      <p className="text-sm text-foreground">{externalTarget}</p>
      <a href={mapsUrl} target="_blank" rel="noreferrer">
        <Button variant={isNear ? "primary" : "secondary"} className="w-full">
          Buka di Peta
        </Button>
      </a>
    </div>
  );
}
