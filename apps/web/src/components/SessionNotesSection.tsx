"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@smartbimbel/ui";
import {
  addSessionNotes,
  Booking,
  BookingAttachment,
  deleteSessionAttachment,
  fetchAttachmentBlob,
  listSessionAttachments,
  uploadSessionDocument,
} from "../lib/bookings";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { hydrateAttachmentImages } from "../lib/hydrateAttachmentImages";
import { RichTextEditor } from "./RichTextEditor";

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function NotesDisplay({ html, bookingId }: { html: string; bookingId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) void hydrateAttachmentImages(ref.current, bookingId);
  }, [html, bookingId]);

  if (looksLikeHtml(html)) {
    return (
      <div
        ref={ref}
        className="session-notes-prose text-sm text-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }
  return <p className="whitespace-pre-wrap text-sm text-foreground">{html}</p>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsSection({ booking, isTutor }: { booking: Booking; isTutor: boolean }) {
  const [attachments, setAttachments] = useState<BookingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listSessionAttachments(booking.id)
      .then((data) => {
        if (!cancelled) setAttachments(data);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat lampiran.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      setError("Format berkas tidak didukung. Gunakan PDF, DOC, DOCX, JPEG, atau PNG.");
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setError("Ukuran berkas maksimal 10MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const attachment = await uploadSessionDocument(booking.id, file);
      setAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah berkas.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: BookingAttachment) {
    try {
      const blob = await fetchAttachmentBlob(booking.id, attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal mengunduh berkas.");
    }
  }

  async function handleDelete(attachment: BookingAttachment) {
    try {
      await deleteSessionAttachment(booking.id, attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch {
      setError("Gagal menghapus lampiran.");
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-sm font-semibold">Lampiran</h3>
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat lampiran...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada lampiran.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-sm"
            >
              <span className="truncate">
                {attachment.filename}{" "}
                <span className="text-muted-foreground">({formatFileSize(attachment.sizeBytes)})</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleDownload(attachment)}>
                  Unduh
                </Button>
                {isTutor && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(attachment)}>
                    Hapus
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isTutor && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,image/jpeg,image/png"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Mengunggah..." : "Unggah Dokumen"}
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Post-session notes (Task 6.3) - tutor-editable rich text, student-read-only.
 * Deliberately not a structured progress-report model (PRD §6.2/Phase 2).
 */
export function SessionNotesSection({
  booking,
  isTutor,
  onUpdated,
}: {
  booking: Booking;
  isTutor: boolean;
  onUpdated: (booking: Booking) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(booking.sessionNotes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      onUpdated(await addSessionNotes(booking.id, value));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan catatan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Catatan Sesi</h2>
      {!editing ? (
        <div className="flex flex-col gap-2">
          {booking.sessionNotes ? (
            <NotesDisplay html={booking.sessionNotes} bookingId={booking.id} />
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada catatan.</p>
          )}
          {isTutor && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setValue(booking.sessionNotes ?? "");
                setEditing(true);
              }}
            >
              {booking.sessionNotes ? "Ubah Catatan" : "Tambah Catatan"}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="session-notes">
            Catatan sesi
          </label>
          <RichTextEditor
            id="session-notes"
            bookingId={booking.id}
            value={value}
            onChange={setValue}
            disabled={submitting}
            placeholder="Topik yang dibahas, PR, langkah selanjutnya..."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={submitting} onClick={handleSave}>
              Simpan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setEditing(false);
                setError(null);
                setValue(booking.sessionNotes ?? "");
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
      <AttachmentsSection booking={booking} isTutor={isTutor} />
    </div>
  );
}
