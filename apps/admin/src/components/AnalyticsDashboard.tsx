"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import {
  AnalyticsSummary,
  CityBreakdownEntry,
  getAnalyticsSummary,
  getCityBreakdown,
} from "../lib/analytics";

function formatIDR(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const PRESET_RANGES = [
  { label: "7 hari", days: 7 },
  { label: "30 hari", days: 30 },
  { label: "90 hari", days: 90 },
];

/**
 * Analytics dashboard (Task 7.6) - every metric named in PRD §3's success
 * metrics table, computed from our own DB (not the separate product-usage
 * analytics tools from Task 0.6). Date-range filtering recomputes every
 * widget via the same query params on both endpoints.
 */
export function AnalyticsDashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cities, setCities] = useState<CityBreakdownEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function refresh(range: { from?: string; to?: string } = { from, to }) {
    setLoading(true);
    setLoadError(null);
    Promise.all([getAnalyticsSummary(range), getCityBreakdown(range)])
      .then(([s, c]) => {
        setSummary(s);
        setCities(c);
      })
      .catch(() => setLoadError("Gagal memuat data analitik."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => refresh({}), []);

  function applyPreset(days: number) {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFrom(fromDate);
    setTo("");
    refresh({ from: fromDate });
  }

  if (loading) return <LoadingSpinner />;
  if (loadError || !summary) {
    return <ErrorState description={loadError ?? "Data tidak ditemukan."} onRetry={() => refresh({})} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-2">
        {PRESET_RANGES.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.days)}
            className="min-h-11 rounded-md border border-input px-3 text-sm hover:bg-muted"
          >
            {p.label}
          </button>
        ))}
        <Input label="Dari" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Sampai" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button
          type="button"
          onClick={() => refresh({ from: from || undefined, to: to || undefined })}
          className="min-h-11 rounded-md bg-primary px-4 text-sm text-white hover:bg-primary/90"
        >
          Terapkan
        </button>
        <button
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
            refresh({});
          }}
          className="min-h-11 rounded-md border border-input px-3 text-sm hover:bg-muted"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tutor Terdaftar</p>
            <p className="mt-1 text-2xl font-semibold">{summary.registeredTutors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Siswa Terdaftar</p>
            <p className="mt-1 text-2xl font-semibold">{summary.registeredStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Booking Selesai</p>
            <p className="mt-1 text-2xl font-semibold">{summary.completedBookings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Konversi Booking</p>
            <p className="mt-1 text-2xl font-semibold">{formatPercent(summary.bookingConversionRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">GMV</p>
            <p className="mt-1 text-2xl font-semibold">{formatIDR(summary.gmv)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendapatan Platform</p>
            <p className="mt-1 text-2xl font-semibold">{formatIDR(summary.platformTake)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rata-rata Rating Sesi</p>
            <p className="mt-1 text-2xl font-semibold">
              {summary.averageSessionRating != null ? summary.averageSessionRating.toFixed(1) : "-"}
            </p>
            <p className="text-xs text-muted-foreground">{summary.ratingCount} ulasan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tingkat Aktivasi Tutor</p>
            <p className="mt-1 text-2xl font-semibold">{formatPercent(summary.tutorActivationRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tingkat Booking Kedua Siswa</p>
            <p className="mt-1 text-2xl font-semibold">{formatPercent(summary.studentSecondBookingRate)}</p>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Berdasarkan Kota</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Kota</th>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">GMV</th>
                <th className="px-3 py-2">Pendapatan Platform</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.city} className="border-t border-border">
                  <td className="px-3 py-2">{c.city}</td>
                  <td className="px-3 py-2">{c.bookingCount}</td>
                  <td className="px-3 py-2">{formatIDR(c.gmv)}</td>
                  <td className="px-3 py-2">{formatIDR(c.platformTake)}</td>
                </tr>
              ))}
              {cities.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
