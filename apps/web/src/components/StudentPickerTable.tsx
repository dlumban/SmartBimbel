"use client";

import { useEffect, useState } from "react";
import { Button, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import { listStudents, StudentListItem } from "../lib/students";

const LIMIT = 10;

/** Paginated, searchable table of students for a tutor to pick from when scheduling a session. */
export function StudentPickerTable({ onSelect }: { onSelect: (student: StudentListItem) => void }) {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    listStudents({ q: appliedQ || undefined, page, limit: LIMIT })
      .then((res) => {
        setStudents(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Gagal memuat daftar siswa."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [appliedQ, page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedQ(q);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex w-full flex-col gap-3">
      <form onSubmit={handleSearch} className="flex items-end gap-2">
        <Input
          label="Cari siswa"
          placeholder="Nama, telepon, atau email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          Cari
        </Button>
      </form>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState description={error} onRetry={refresh} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Telepon</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      Tidak ada siswa yang cocok.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.studentProfileId} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">
                        {s.name ?? "Tanpa nama"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{s.phone ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.email ?? "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" onClick={() => onSelect(s)}>
                          Pilih
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="min-h-11 px-3 disabled:text-muted-foreground/50"
              >
                Sebelumnya
              </button>
              <span className="text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-11 px-3 disabled:text-muted-foreground/50"
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
