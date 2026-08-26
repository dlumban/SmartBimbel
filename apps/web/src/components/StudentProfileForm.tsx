"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, Input, LoadingSpinner } from "@smartbimbel/ui";
import { getGradeLevels, getSubjects, GradeLevel, Subject } from "../lib/masterData";
import { createStudentProfile } from "../lib/students";
import { updateName } from "../lib/api";

export function StudentProfileForm({ onSuccess }: { onSuccess: () => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [preferredLocation, setPreferredLocation] = useState("");
  const [preferredMode, setPreferredMode] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getSubjects(), getGradeLevels()])
      .then(([subjectList, gradeLevelList]) => {
        setSubjects(subjectList);
        setGradeLevels(gradeLevelList);
      })
      .catch(() => setLoadError("Gagal memuat data mata pelajaran/jenjang."))
      .finally(() => setLoadingOptions(false));
  }, []);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Isi nama lengkap Anda.");
      return;
    }
    if (!gradeLevelId) {
      setFormError("Pilih jenjang pendidikan.");
      return;
    }
    if (selectedSubjectIds.length === 0) {
      setFormError("Pilih minimal satu mata pelajaran.");
      return;
    }

    setSubmitting(true);
    try {
      await updateName(name.trim());
      await createStudentProfile({
        gradeLevelId,
        subjectIds: selectedSubjectIds,
        preferredLocation: preferredLocation || undefined,
        preferredMode,
      });
      onSuccess();
    } catch {
      setFormError("Gagal menyimpan profil. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingOptions) {
    return <LoadingSpinner label="Memuat pilihan..." />;
  }

  if (loadError) {
    return <p className="text-destructive">{loadError}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-5">
      <Input label="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} />

      <div>
        <label htmlFor="gradeLevel" className="text-sm font-medium text-foreground">
          Jenjang pendidikan
        </label>
        <select
          id="gradeLevel"
          value={gradeLevelId}
          onChange={(e) => setGradeLevelId(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-input px-3"
        >
          <option value="">Pilih jenjang</option>
          {gradeLevels.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Mata pelajaran yang diminati
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {subjects.map((s) => {
            const selected = selectedSubjectIds.includes(s.id);
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => toggleSubject(s.id)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-foreground"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="location" className="text-sm font-medium text-foreground">
          Lokasi (opsional)
        </label>
        <input
          id="location"
          value={preferredLocation}
          onChange={(e) => setPreferredLocation(e.target.value)}
          placeholder="Contoh: Jakarta Selatan"
          className="mt-1 min-h-11 w-full rounded-md border border-input px-3"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Mode belajar</legend>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              checked={preferredMode === "ONLINE"}
              onChange={() => setPreferredMode("ONLINE")}
            />
            Online
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              checked={preferredMode === "OFFLINE"}
              onChange={() => setPreferredMode("OFFLINE")}
            />
            Tatap muka
          </label>
        </div>
      </fieldset>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Menyimpan..." : "Simpan profil"}
      </Button>
    </form>
  );
}
