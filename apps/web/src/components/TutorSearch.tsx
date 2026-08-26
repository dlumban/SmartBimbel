"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, EmptyState, ErrorState, LoadingSpinner, TutorCard } from "@smartbimbel/ui";
import { SUPPORTED_CITIES } from "@smartbimbel/shared";
import { getGradeLevels, getSubjects, GradeLevel, Subject } from "../lib/masterData";
import { PaginatedTutorList, searchTutors, SearchTutorsParams } from "../lib/discovery";
import { formatIDR } from "@smartbimbel/shared";

const PAGE_SIZE = 12;

export function TutorSearch() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);

  const [filters, setFilters] = useState<SearchTutorsParams>({ page: 1, limit: PAGE_SIZE });
  const [qInput, setQInput] = useState("");
  const [result, setResult] = useState<PaginatedTutorList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getSubjects(), getGradeLevels()]).then(([s, g]) => {
      setSubjects(s);
      setGradeLevels(g);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    searchTutors(filters)
      .then(setResult)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [filters]);

  function updateFilter(patch: Partial<SearchTutorsParams>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  function handleSearchSubmit() {
    updateFilter({ q: qInput || undefined });
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / (filters.limit ?? PAGE_SIZE))) : 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap gap-3">
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              placeholder="Cari nama tutor atau kata kunci..."
              className="min-h-11 flex-1 rounded-md border border-input px-3"
              aria-label="Cari tutor"
            />
            <Button type="button" onClick={handleSearchSubmit}>
              Cari
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Mata pelajaran"
              className="min-h-11 w-full rounded-md border border-input px-3 sm:w-auto"
              value={filters.subjectId ?? ""}
              onChange={(e) => updateFilter({ subjectId: e.target.value || undefined })}
            >
              <option value="">Semua mata pelajaran</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Jenjang"
              className="min-h-11 w-full rounded-md border border-input px-3 sm:w-auto"
              value={filters.gradeLevelId ?? ""}
              onChange={(e) => updateFilter({ gradeLevelId: e.target.value || undefined })}
            >
              <option value="">Semua jenjang</option>
              {gradeLevels.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Kota"
              className="min-h-11 w-full rounded-md border border-input px-3 sm:w-auto"
              value={filters.city ?? ""}
              onChange={(e) => updateFilter({ city: e.target.value || undefined })}
            >
              <option value="">Semua kota</option>
              {SUPPORTED_CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Mode belajar"
              className="min-h-11 w-full rounded-md border border-input px-3 sm:w-auto"
              value={filters.mode ?? ""}
              onChange={(e) =>
                updateFilter({ mode: (e.target.value || undefined) as "ONLINE" | "OFFLINE" | undefined })
              }
            >
              <option value="">Semua mode</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Tatap muka</option>
            </select>

            <select
              aria-label="Urutkan"
              className="min-h-11 w-full rounded-md border border-input px-3 sm:w-auto"
              value={filters.sort ?? ""}
              onChange={(e) => {
                const sort = (e.target.value || undefined) as SearchTutorsParams["sort"];
                updateFilter({
                  sort,
                  near: sort === "nearest" ? filters.city ?? SUPPORTED_CITIES[0].name : undefined,
                });
              }}
            >
              <option value="">Terbaru</option>
              <option value="price">Harga terendah</option>
              <option value="nearest">Terdekat</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!loading && error && (
        <ErrorState onRetry={() => setFilters((f) => ({ ...f }))} />
      )}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          title="Tidak ada tutor yang cocok"
          description="Coba ubah filter pencarian Anda."
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {result.data.map((tutor) => (
              <TutorCard
                key={tutor.id}
                name={tutor.name ?? "Tutor SmartBimbel"}
                photoUrl={tutor.photoUrl}
                subjects={tutor.subjects}
                hourlyRateLabel={tutor.hourlyRate ? formatIDR(tutor.hourlyRate) : "-"}
                rating={tutor.rating}
                reviewCount={tutor.reviewCount}
                city={
                  tutor.distanceKm != null
                    ? `${tutor.city} (${tutor.distanceKm} km)`
                    : tutor.city
                }
                modes={tutor.teachingModes.map((m) => m.toLowerCase()) as ("online" | "offline")[]}
                onClick={() => router.push(`/tutors/${tutor.id}`)}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="secondary"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">
              Halaman {filters.page ?? 1} dari {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Berikutnya
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
