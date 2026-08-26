"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import { AddStudentModal } from "./AddStudentModal";
import {
  AccessLink,
  AdminUserDetail,
  AdminUserListItem,
  deleteUser,
  deactivateAccessLink,
  generateAccessLink,
  getUserDetail,
  reinstateUser,
  searchUsers,
  setAdminRole,
  suspendUser,
} from "../lib/users";

const DELETE_CONFIRM_WORD = "HAPUS";

/**
 * User management (Task 7.3) - search/list/detail, suspend/reinstate
 * (either admin sub-role, PRD §5), admin sub-role management
 * (Super-Admin-only, enforced server-side; the button is also hidden
 * client-side for a Support admin as a UX nicety, not the real gate),
 * adding a Student account directly (no Firebase sign-up required), and
 * permanently deleting an account - unlike suspend, this destroys the
 * account and everything it owns (bookings, transactions, messages, ...)
 * with no undo, so it's gated behind typing a confirmation word.
 */
export function UsersManagement() {
  const { sessionUser } = useAuth();
  const isSuperAdmin = sessionUser?.adminRole === "SUPER_ADMIN";

  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [accessLink, setAccessLink] = useState<AccessLink | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    searchUsers({ q: q || undefined })
      .then((res) => setUsers(res.data))
      .catch(() => setLoadError("Gagal memuat daftar pengguna."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  function loadDetail(id: string) {
    setSelectedId(id);
    setActionError(null);
    setShowSuspendForm(false);
    setShowDeleteForm(false);
    setDeleteConfirmText("");
    setAccessLink(null);
    setLinkCopied(false);
    getUserDetail(id).then(setDetail).catch(() => setActionError("Gagal memuat detail."));
  }

  async function handleSuspend() {
    if (!selectedId || !suspendReason.trim()) {
      setActionError("Alasan penangguhan wajib diisi.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await suspendUser(selectedId, suspendReason);
      loadDetail(selectedId);
      setSuspendReason("");
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menangguhkan pengguna.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReinstate() {
    if (!selectedId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await reinstateUser(selectedId);
      loadDetail(selectedId);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memulihkan pengguna.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || deleteConfirmText !== DELETE_CONFIRM_WORD) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await deleteUser(selectedId);
      setSelectedId(null);
      setDetail(null);
      setShowDeleteForm(false);
      setDeleteConfirmText("");
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus pengguna.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateAccessLink() {
    if (!selectedId) return;
    setSubmitting(true);
    setActionError(null);
    setLinkCopied(false);
    try {
      setAccessLink(await generateAccessLink(selectedId));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal membuat link akses.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateAccessLink() {
    if (!selectedId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await deactivateAccessLink(selectedId);
      setAccessLink(null);
      setLinkCopied(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menonaktifkan link akses.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetAdminRole(role: "SUPER_ADMIN" | "SUPPORT") {
    if (!selectedId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await setAdminRole(selectedId, role);
      loadDetail(selectedId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal mengubah peran admin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            refresh();
          }}
          className="flex gap-2"
        >
          <Input
            label="Cari"
            placeholder="Nama, email, atau telepon"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit" className="mt-6">
            Cari
          </Button>
        </form>

        <Button type="button" variant="secondary" onClick={() => setShowAddStudent(true)}>
          Tambah Siswa
        </Button>

        {loading && <LoadingSpinner />}
        {loadError && <ErrorState description={loadError} onRetry={refresh} />}
        {!loading && !loadError && (
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => loadDetail(u.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${
                    selectedId === u.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{u.name ?? "Tanpa nama"}</span>
                    <Badge variant={u.status === "ACTIVE" ? "online" : "offline"}>{u.status}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {u.role ?? "-"} &middot; {u.email ?? u.phone ?? "-"}
                  </p>
                </button>
              </li>
            ))}
            {users.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada hasil.</p>}
          </ul>
        )}
      </div>

      <div>
        {!detail ? (
          <p className="text-sm text-muted-foreground">Pilih pengguna untuk melihat detail.</p>
        ) : (
          <Card>
            <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{detail.name ?? "Tanpa nama"}</h2>
              <Badge variant={detail.status === "ACTIVE" ? "online" : "offline"}>{detail.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.email ?? "-"} &middot; {detail.phone ?? "-"}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Peran</dt>
                <dd>{detail.role ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Jumlah booking</dt>
                <dd>{detail.bookingCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Jumlah transaksi</dt>
                <dd>{detail.transactionCount}</dd>
              </div>
            </dl>

            {actionError && <p className="mt-3 text-sm text-destructive">{actionError}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {detail.status === "ACTIVE" ? (
                !showSuspendForm ? (
                  <Button variant="danger" disabled={submitting} onClick={() => setShowSuspendForm(true)}>
                    Tangguhkan
                  </Button>
                ) : null
              ) : (
                <Button disabled={submitting} onClick={handleReinstate}>
                  Pulihkan
                </Button>
              )}
              {!showDeleteForm && (
                <Button variant="danger" disabled={submitting} onClick={() => setShowDeleteForm(true)}>
                  Hapus
                </Button>
              )}
              {detail.role === "STUDENT" && (
                <Button variant="secondary" disabled={submitting} onClick={handleGenerateAccessLink}>
                  Buat Link Akses
                </Button>
              )}
              {isSuperAdmin && detail.role === "ADMIN" && (
                <>
                  <Button
                    variant="secondary"
                    disabled={submitting || detail.adminRole === "SUPER_ADMIN"}
                    onClick={() => handleSetAdminRole("SUPER_ADMIN")}
                  >
                    Jadikan Super Admin
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={submitting || detail.adminRole === "SUPPORT"}
                    onClick={() => handleSetAdminRole("SUPPORT")}
                  >
                    Jadikan Support
                  </Button>
                </>
              )}
            </div>

            {showSuspendForm && (
              <div className="mt-3 flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="suspend-reason">
                  Alasan penangguhan
                </label>
                <textarea
                  id="suspend-reason"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={2}
                  className="rounded-md border border-input p-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={submitting} onClick={handleSuspend}>
                    Konfirmasi Tangguhkan
                  </Button>
                  <Button variant="ghost" disabled={submitting} onClick={() => setShowSuspendForm(false)}>
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {showDeleteForm && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-sm text-destructive">
                  Ini akan menghapus akun beserta seluruh riwayat booking, transaksi, pesan, dan
                  ulasannya secara permanen ({detail.bookingCount} booking, {detail.transactionCount}{" "}
                  transaksi). Tindakan ini tidak bisa dibatalkan.
                </p>
                <label className="text-sm font-medium" htmlFor="delete-confirm">
                  {`Ketik "${DELETE_CONFIRM_WORD}" untuk konfirmasi`}
                </label>
                <input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="min-h-11 rounded-md border border-input px-3 text-base"
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={submitting || deleteConfirmText !== DELETE_CONFIRM_WORD}
                    onClick={handleDelete}
                  >
                    Konfirmasi Hapus
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => {
                      setShowDeleteForm(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {accessLink && (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/10 p-3">
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
                    Bisa dipakai berulang kali sampai dinonaktifkan.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={submitting}
                    onClick={handleDeactivateAccessLink}
                  >
                    Nonaktifkan Link
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        )}
      </div>

      <AddStudentModal
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onCreated={() => {
          setShowAddStudent(false);
          refresh();
        }}
      />
    </div>
  );
}
