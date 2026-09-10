"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import { StudentFormModal } from "./StudentFormModal";
import {
  AccessLink,
  StudentListItem,
  deactivateStudentAccessLink,
  generateStudentAccessLink,
  listStudents,
} from "../lib/students";

const LIMIT = 10;

/**
 * A tutor's private roster - students they added themselves (Task: tutor
 * self-service onboarding). Lets a tutor add a student (no Firebase sign-up
 * required) and generate a one-time sign-in link for them; the API rejects
 * generating a link for any student this tutor didn't add.
 */
export function MyStudentsPage() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentListItem | null>(null);

  const [linkTargetId, setLinkTargetId] = useState<string | null>(null);
  const [accessLink, setAccessLink] = useState<AccessLink | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function refresh() {
    setLoading(true);
    setError(null);
    listStudents({ mine: true, q: appliedQ || undefined, page, limit: LIMIT })
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

  async function handleGenerateAccessLink(userId: string) {
    setLinkTargetId(userId);
    setAccessLink(null);
    setLinkCopied(false);
    setLinkError(null);
    setGenerating(true);
    try {
      setAccessLink(await generateStudentAccessLink(userId));
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Gagal membuat link akses.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeactivateAccessLink() {
    if (!linkTargetId) return;
    setGenerating(true);
    setLinkError(null);
    try {
      await deactivateStudentAccessLink(linkTargetId);
      setAccessLink(null);
      setLinkCopied(false);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Gagal menonaktifkan link akses.");
    } finally {
      setGenerating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Murid Saya</h1>
        <Button type="button" variant="secondary" onClick={() => setShowAddStudent(true)}>
          Tambah Siswa
        </Button>
      </div>

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
                      Belum ada siswa yang Anda tambahkan.
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
                        <div className="flex justify-end gap-2">
                          <Link href={`/students/${s.userId}/schedule`}>
                            <Button size="sm" variant="secondary">
                              Jadwal
                            </Button>
                          </Link>
                          <Button size="sm" variant="secondary" onClick={() => setEditTarget(s)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={generating && linkTargetId === s.userId}
                            onClick={() => handleGenerateAccessLink(s.userId)}
                          >
                            Buat Link Akses
                          </Button>
                        </div>
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

      {linkError && <p className="text-sm text-destructive">{linkError}</p>}

      {accessLink && (
        <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/10 p-3">
          <label className="text-sm font-medium" htmlFor="access-link-url">
            Link akses (aktif sampai dinonaktifkan)
          </label>
          <div className="flex gap-2">
            <input
              id="access-link-url"
              readOnly
              value={accessLink.url}
              onFocus={(e) => e.target.select()}
              className="min-h-11 flex-1 rounded-md border border-input px-3 text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(accessLink.url);
                setLinkCopied(true);
              }}
            >
              {linkCopied ? "Tersalin" : "Salin"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Bisa dipakai berulang kali sampai Anda menonaktifkannya.
            </p>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={generating}
              onClick={handleDeactivateAccessLink}
            >
              Nonaktifkan Link
            </Button>
          </div>
        </div>
      )}

      <StudentFormModal
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onSaved={() => {
          setShowAddStudent(false);
          refresh();
        }}
      />

      <StudentFormModal
        open={editTarget != null}
        student={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          refresh();
        }}
      />
    </div>
  );
}
