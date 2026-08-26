"use client";

import { useEffect, useState } from "react";
import { Button } from "@smartbimbel/ui";
import { getReview, Review, submitReview } from "../lib/reviews";
import { trackEvent } from "../lib/analytics";

const STAR_VALUES = [1, 2, 3, 4, 5];

/**
 * Student-only rating + optional text review (Task 6.4) - one-directional
 * per PRD §6.1.G's confirmed reading (tutors don't review students).
 * Editable within REVIEW_EDIT_WINDOW_HOURS of first submission; past that
 * the backend rejects the edit and its error message is surfaced as-is.
 */
export function ReviewSection({ bookingId }: { bookingId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReview(bookingId)
      .then((r) => {
        setReview(r);
        if (r) {
          setRating(r.rating);
          setText(r.text ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitReview(bookingId, { rating, text: text || undefined });
      void trackEvent("review_submitted", { rating });
      setReview(result);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim ulasan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (review && !editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Ulasan Anda</h2>
        <span className="text-warning-500" aria-label={`Rating ${review.rating} dari 5`}>
          {"★".repeat(review.rating)}
          {"☆".repeat(5 - review.rating)}
        </span>
        {review.text && <p className="text-sm text-foreground">{review.text}</p>}
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setEditing(true)}>
          Ubah Ulasan
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">{review ? "Ubah Ulasan" : "Beri Ulasan"}</h2>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {STAR_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={rating === v}
            aria-label={`${v} bintang`}
            onClick={() => setRating(v)}
            className="text-2xl text-warning-500"
          >
            {v <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="review-text">
        Ulasan (opsional)
      </label>
      <textarea
        id="review-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="rounded-md border border-input p-2 text-sm"
        placeholder="Ceritakan pengalaman Anda (opsional)"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={submitting} onClick={handleSubmit}>
          Kirim Ulasan
        </Button>
        {review && (
          <Button
            size="sm"
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
          >
            Batal
          </Button>
        )}
      </div>
    </div>
  );
}
