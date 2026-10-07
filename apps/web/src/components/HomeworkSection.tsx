"use client";

import { useEffect, useRef, useState } from "react";
import { Button, LoadingSpinner } from "@smartbimbel/ui";
import {
  createHomework,
  HomeworkAssignment,
  listHomework,
  reviewHomework,
  submitHomework,
} from "../lib/progress";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { hydrateAttachmentImages } from "../lib/hydrateAttachmentImages";
import { RichTextEditor } from "./RichTextEditor";

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function DescriptionDisplay({ html, bookingId }: { html: string; bookingId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) void hydrateAttachmentImages(ref.current, bookingId);
  }, [html, bookingId]);

  if (looksLikeHtml(html)) {
    return (
      <div
        ref={ref}
        className="session-notes-prose mt-1 text-sm text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }
  return <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{html}</p>;
}

export function HomeworkSection({
  bookingId,
  isTutor,
}: {
  bookingId: string;
  isTutor: boolean;
}) {
  const [items, setItems] = useState<HomeworkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitDrafts, setSubmitDrafts] = useState<Record<string, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    listHomework(bookingId)
      .then(setItems)
      .catch(() => setError("Gagal memuat tugas."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [bookingId]);

  async function handleCreate() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createHomework(bookingId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueAt: dueAt || undefined,
      });
      setTitle("");
      setDescription("");
      setDueAt("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat tugas.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(id: string) {
    const content = submitDrafts[id]?.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      await submitHomework(id, content);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim tugas.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(id: string) {
    setBusy(true);
    setError(null);
    try {
      await reviewHomework(id, feedbackDrafts[id]?.trim() || undefined);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal meninjau tugas.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Tugas / PR</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {isTutor && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-input p-3">
          <input
            placeholder="Judul tugas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 rounded-md border border-input px-3 text-sm"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="homework-description">
              Deskripsi (opsional)
            </label>
            <RichTextEditor
              id="homework-description"
              bookingId={bookingId}
              value={description}
              onChange={setDescription}
              disabled={busy}
              placeholder="Jelaskan tugas, langkah pengerjaan, atau sisipkan gambar..."
            />
          </div>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="min-h-11 rounded-md border border-input px-3 text-sm"
          />
          <Button size="sm" disabled={busy || !title.trim()} onClick={handleCreate}>
            Berikan tugas
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada tugas untuk sesi ini.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((hw) => {
            const submission = hw.submissions[0];
            return (
              <li key={hw.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{hw.title}</p>
                    {hw.description && (
                      <DescriptionDisplay html={hw.description} bookingId={bookingId} />
                    )}
                    {hw.dueAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tenggat: {new Date(hw.dueAt).toLocaleDateString("id-ID")}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{hw.status}</span>
                </div>

                {submission && (
                  <div className="mt-2 rounded bg-muted/50 p-2">
                    <p className="text-xs font-medium">Jawaban siswa</p>
                    <p className="mt-1 whitespace-pre-wrap">{submission.content}</p>
                    {submission.tutorFeedback && (
                      <p className="mt-2 text-xs">
                        Feedback: {submission.tutorFeedback}
                      </p>
                    )}
                  </div>
                )}

                {!isTutor && hw.status !== "REVIEWED" && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      placeholder="Tulis jawaban Anda"
                      value={submitDrafts[hw.id] ?? ""}
                      onChange={(e) =>
                        setSubmitDrafts((d) => ({ ...d, [hw.id]: e.target.value }))
                      }
                      rows={3}
                      className="rounded-md border border-input p-2"
                    />
                    <Button
                      size="sm"
                      disabled={busy || !(submitDrafts[hw.id] ?? "").trim()}
                      onClick={() => handleSubmit(hw.id)}
                    >
                      Kirim jawaban
                    </Button>
                  </div>
                )}

                {isTutor && submission && hw.status !== "REVIEWED" && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      placeholder="Feedback (opsional)"
                      value={feedbackDrafts[hw.id] ?? ""}
                      onChange={(e) =>
                        setFeedbackDrafts((d) => ({ ...d, [hw.id]: e.target.value }))
                      }
                      rows={2}
                      className="rounded-md border border-input p-2"
                    />
                    <Button size="sm" disabled={busy} onClick={() => handleReview(hw.id)}>
                      Tandai ditinjau
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
