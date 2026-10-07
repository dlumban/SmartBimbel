"use client";

import { useEffect, useState } from "react";
import { Button, LoadingSpinner } from "@smartbimbel/ui";
import {
  getProgressReport,
  ProgressReport,
  upsertProgressReport,
} from "../lib/progress";

export function ProgressReportSection({
  bookingId,
  isTutor,
}: {
  bookingId: string;
  isTutor: boolean;
}) {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [topicsCovered, setTopicsCovered] = useState("");
  const [strengths, setStrengths] = useState("");
  const [areasToImprove, setAreasToImprove] = useState("");
  const [nextGoals, setNextGoals] = useState("");
  const [overallScore, setOverallScore] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgressReport(bookingId)
      .then((r) => {
        setReport(r);
        if (r) {
          setTopicsCovered(r.topicsCovered);
          setStrengths(r.strengths ?? "");
          setAreasToImprove(r.areasToImprove ?? "");
          setNextGoals(r.nextGoals ?? "");
          setOverallScore(r.overallScore ?? "");
        }
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function save() {
    if (!topicsCovered.trim()) {
      setError("Topik yang dibahas wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertProgressReport(bookingId, {
        topicsCovered: topicsCovered.trim(),
        strengths: strengths.trim() || undefined,
        areasToImprove: areasToImprove.trim() || undefined,
        nextGoals: nextGoals.trim() || undefined,
        overallScore: overallScore === "" ? undefined : Number(overallScore),
      });
      setReport(saved);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan laporan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Laporan Progress</h2>
        {isTutor && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {report ? "Edit" : "Isi laporan"}
          </Button>
        )}
      </div>

      {!report && !editing && (
        <p className="text-sm text-muted-foreground">Belum ada laporan progress untuk sesi ini.</p>
      )}

      {(editing || report) && (
        <div className="flex flex-col gap-2 text-sm">
          {editing ? (
            <>
              <label className="font-medium" htmlFor="pr-topics">
                Topik yang dibahas
              </label>
              <textarea
                id="pr-topics"
                value={topicsCovered}
                onChange={(e) => setTopicsCovered(e.target.value)}
                rows={2}
                className="rounded-md border border-input p-2"
              />
              <label className="font-medium" htmlFor="pr-strengths">
                Kekuatan
              </label>
              <textarea
                id="pr-strengths"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                rows={2}
                className="rounded-md border border-input p-2"
              />
              <label className="font-medium" htmlFor="pr-improve">
                Area perbaikan
              </label>
              <textarea
                id="pr-improve"
                value={areasToImprove}
                onChange={(e) => setAreasToImprove(e.target.value)}
                rows={2}
                className="rounded-md border border-input p-2"
              />
              <label className="font-medium" htmlFor="pr-goals">
                Tujuan berikutnya
              </label>
              <textarea
                id="pr-goals"
                value={nextGoals}
                onChange={(e) => setNextGoals(e.target.value)}
                rows={2}
                className="rounded-md border border-input p-2"
              />
              <label className="font-medium" htmlFor="pr-score">
                Skor keseluruhan (1–5, opsional)
              </label>
              <select
                id="pr-score"
                value={overallScore}
                onChange={(e) =>
                  setOverallScore(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="min-h-11 rounded-md border border-input px-3"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {error && <p className="text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button disabled={saving} onClick={save}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
                  Batal
                </Button>
              </div>
            </>
          ) : (
            report && (
              <>
                <p>
                  <span className="font-medium">Topik:</span> {report.topicsCovered}
                </p>
                {report.strengths && (
                  <p>
                    <span className="font-medium">Kekuatan:</span> {report.strengths}
                  </p>
                )}
                {report.areasToImprove && (
                  <p>
                    <span className="font-medium">Perbaikan:</span> {report.areasToImprove}
                  </p>
                )}
                {report.nextGoals && (
                  <p>
                    <span className="font-medium">Tujuan:</span> {report.nextGoals}
                  </p>
                )}
                {report.overallScore != null && (
                  <p>
                    <span className="font-medium">Skor:</span> {report.overallScore}/5
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
