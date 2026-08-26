"use client";

import { useState } from "react";
import { Button } from "@smartbimbel/ui";
import { isValidMeetingLink } from "@smartbimbel/shared";
import { Booking, setMeeting } from "../lib/bookings";

/**
 * Either party can set/update the meeting link (ONLINE) or address
 * (OFFLINE) tied to the booking (Task 4.3) - stored on Booking, not
 * parsed out of chat messages, so Sprint 6's "Join Meeting" button has a
 * reliable field to read. Also shown read-only on the booking detail
 * screen (Task 4.3's "visible in both the chat thread and the booking
 * detail screen").
 */
export function MeetingInfoSection({
  booking,
  onUpdated,
}: {
  booking: Booking;
  onUpdated: (booking: Booking) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    booking.mode === "ONLINE" ? booking.meetingLink ?? "" : booking.meetingAddress ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOnline = booking.mode === "ONLINE";
  const current = isOnline ? booking.meetingLink : booking.meetingAddress;

  async function handleSubmit() {
    setError(null);
    if (isOnline && !isValidMeetingLink(value)) {
      setError("Link harus berupa URL Zoom atau Google Meet yang valid.");
      return;
    }
    if (!isOnline && value.trim().length === 0) {
      setError("Alamat pertemuan tidak boleh kosong.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await setMeeting(
        booking.id,
        isOnline ? { meetingLink: value } : { meetingAddress: value },
      );
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">
        {isOnline ? "Link Pertemuan" : "Alamat Pertemuan"}
      </h2>

      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          {current ? (
            isOnline ? (
              <a
                href={current}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-primary hover:underline"
              >
                {current}
              </a>
            ) : (
              <span className="text-sm text-foreground">{current}</span>
            )
          ) : (
            <span className="text-sm text-muted-foreground">
              {isOnline ? "Belum ada link pertemuan." : "Belum ada alamat pertemuan."}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {current ? "Ubah" : "Atur"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="meeting-value">
            {isOnline ? "Link pertemuan" : "Alamat pertemuan"}
          </label>
          <input
            id="meeting-value"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isOnline ? "https://zoom.us/j/..." : "Jl. Contoh No. 1, Jakarta"}
            className="min-h-11 rounded-md border border-input px-3 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setEditing(false);
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
