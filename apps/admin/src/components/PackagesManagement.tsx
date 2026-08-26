"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import { ALLOWED_BOOKING_DURATIONS_MINUTES } from "@smartbimbel/shared";
import {
  createPackage,
  listPackages,
  PackageInput,
  setPackageActive,
  TutoringPackage,
  updatePackage,
} from "../lib/packages";

const emptyForm: PackageInput = {
  name: "",
  sessionCount: 1,
  durationMinutes: ALLOWED_BOOKING_DURATIONS_MINUTES[0],
  totalPrice: 0,
};

/**
 * Admin management of fixed-price tutoring packages - a reusable pricing
 * template a tutor can pick when scheduling a session, overriding normal
 * hourly-rate pricing for that booking. Never hard-deleted, only toggled
 * inactive (historical bookings may reference one permanently).
 */
export function PackagesManagement() {
  const [packages, setPackages] = useState<TutoringPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PackageInput>(emptyForm);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    listPackages()
      .then(setPackages)
      .catch(() => setLoadError("Gagal memuat daftar paket."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setActionError(null);
    setShowForm(true);
  }

  function openEditForm(pkg: TutoringPackage) {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      sessionCount: pkg.sessionCount,
      durationMinutes: pkg.durationMinutes,
      totalPrice: pkg.totalPrice,
    });
    setActionError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setActionError("Nama paket wajib diisi.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      if (editingId) {
        await updatePackage(editingId, form);
      } else {
        await createPackage(form);
      }
      setShowForm(false);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal menyimpan paket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(pkg: TutoringPackage) {
    setSubmitting(true);
    setActionError(null);
    try {
      await setPackageActive(pkg.id, !pkg.isActive);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengubah status paket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError) return <ErrorState description={loadError} onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Paket yang aktif bisa dipilih tutor saat menjadwalkan sesi, menggantikan tarif per jam.
        </p>
        <Button onClick={openCreateForm}>Tambah Paket</Button>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="Nama paket"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="Jumlah sesi"
                type="number"
                min={1}
                value={form.sessionCount}
                onChange={(e) => setForm({ ...form, sessionCount: Number(e.target.value) })}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="package-duration" className="text-sm font-medium text-neutral-700">
                  Durasi per sesi (menit)
                </label>
                <select
                  id="package-duration"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="min-h-11 rounded-md border border-neutral-300 px-3 text-base"
                >
                  {ALLOWED_BOOKING_DURATIONS_MINUTES.map((d) => (
                    <option key={d} value={d}>
                      {d} menit
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Total harga (Rp)"
                type="number"
                min={1}
                value={form.totalPrice}
                onChange={(e) => setForm({ ...form, totalPrice: Number(e.target.value) })}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  Simpan
                </Button>
                <Button type="button" variant="ghost" disabled={submitting} onClick={() => setShowForm(false)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-col gap-2">
        {packages.map((pkg) => (
          <li key={pkg.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 pt-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{pkg.name}</span>
                    <Badge variant={pkg.isActive ? "online" : "offline"}>
                      {pkg.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pkg.sessionCount} sesi &middot; {pkg.durationMinutes} menit/sesi &middot; Rp
                    {pkg.totalPrice.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={submitting} onClick={() => openEditForm(pkg)}>
                    Ubah
                  </Button>
                  <Button
                    variant={pkg.isActive ? "danger" : "secondary"}
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleToggleActive(pkg)}
                  >
                    {pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
        {packages.length === 0 && <p className="text-sm text-muted-foreground">Belum ada paket.</p>}
      </ul>
    </div>
  );
}
