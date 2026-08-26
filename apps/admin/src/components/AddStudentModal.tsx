"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal } from "@smartbimbel/ui";
import { GradeLevel, Subject, getGradeLevels, getSubjects } from "../lib/masterData";
import { createStudent } from "../lib/users";

export interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Lets an admin onboard a student directly - no Firebase sign-up required.
 * If that student later logs in themselves, the API links their real
 * account to this same record by phone/email rather than duplicating it.
 */
export function AddStudentModal({ open, onClose, onCreated }: AddStudentModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [preferredMode, setPreferredMode] = useState<"" | "ONLINE" | "OFFLINE">("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    getGradeLevels().then(setGradeLevels).catch(() => setGradeLevels([]));
    getSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, [open]);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setGradeLevelId("");
    setPreferredLocation("");
    setPreferredMode("");
    setSubjectIds([]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleSubject(id: string) {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Isi telepon atau email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createStudent({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gradeLevelId: gradeLevelId || undefined,
        subjectIds: subjectIds.length > 0 ? subjectIds : undefined,
        preferredLocation: preferredLocation.trim() || undefined,
        preferredMode: preferredMode || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan siswa.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tambah Siswa">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Telepon" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <div className="flex flex-col gap-1">
          <label htmlFor="add-student-grade" className="text-sm font-medium text-neutral-700">
            Jenjang
          </label>
          <select
            id="add-student-grade"
            value={gradeLevelId}
            onChange={(e) => setGradeLevelId(e.target.value)}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-base"
          >
            <option value="">Tidak ditentukan</option>
            {gradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {subjects.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium text-neutral-700">Mata pelajaran</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={subjectIds.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Input
          label="Lokasi"
          value={preferredLocation}
          onChange={(e) => setPreferredLocation(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="add-student-mode" className="text-sm font-medium text-neutral-700">
            Mode belajar
          </label>
          <select
            id="add-student-mode"
            value={preferredMode}
            onChange={(e) => setPreferredMode(e.target.value as "" | "ONLINE" | "OFFLINE")}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-base"
          >
            <option value="">Tidak ditentukan</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="mt-2 flex gap-2">
          <Button type="submit" disabled={submitting}>
            Simpan
          </Button>
          <Button type="button" variant="ghost" disabled={submitting} onClick={handleClose}>
            Batal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
