"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Button, Input, LoadingSpinner } from "@smartbimbel/ui";
import { getGradeLevels, getSubjects, GradeLevel, Subject } from "../lib/masterData";
import {
  getMyTutorProfile,
  submitTutorProfileForReview,
  uploadTutorDocument,
  upsertTutorProfile,
} from "../lib/tutors";
import { updateName } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

type Step = 1 | 2 | 3 | 4;

/** First step whose required fields aren't filled in yet on an existing profile. */
function resumeStepFor(profile: Awaited<ReturnType<typeof getMyTutorProfile>>): Step {
  if (!profile) return 1;
  if (!profile.bio || !profile.education) return 1;
  if (profile.subjects.length === 0 || profile.gradeLevels.length === 0) return 2;
  if (!profile.hourlyRate || profile.teachingModes.length === 0 || !profile.city) return 3;
  return 4;
}

export function TutorProfileWizard({ onSubmitted }: { onSubmitted: () => void }) {
  const { sessionUser } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "PENDING" | "VERIFIED" | "REJECTED" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Step 1
  const [name, setName] = useState(sessionUser?.name ?? "");
  const [bio, setBio] = useState("");
  const [education, setEducation] = useState("");
  // Step 2
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [gradeLevelIds, setGradeLevelIds] = useState<string[]>([]);
  // Step 3
  const [hourlyRate, setHourlyRate] = useState("");
  const [teachingModes, setTeachingModes] = useState<("ONLINE" | "OFFLINE")[]>([]);
  const [city, setCity] = useState("");
  // Step 4
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);

  useEffect(() => {
    Promise.all([getSubjects(), getGradeLevels(), getMyTutorProfile()])
      .then(([s, g, profile]) => {
        setSubjects(s);
        setGradeLevels(g);
        if (profile) {
          setBio(profile.bio ?? "");
          setEducation(profile.education ?? "");
          setSubjectIds(profile.subjects.map((x) => x.id));
          setGradeLevelIds(profile.gradeLevels.map((x) => x.id));
          setHourlyRate(profile.hourlyRate ? String(profile.hourlyRate) : "");
          setTeachingModes(profile.teachingModes);
          setCity(profile.city ?? "");
          setVerificationStatus(profile.verificationStatus);
          setRejectionReason(profile.rejectionReason);
        }
        setStep(resumeStepFor(profile));
      })
      .catch(() => setError("Gagal memuat data mata pelajaran/jenjang."))
      .finally(() => setLoadingOptions(false));
  }, []);

  function toggle<T>(list: T[], value: T, setter: (v: T[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function saveStepAndAdvance() {
    setError(null);
    setSaving(true);
    try {
      if (step === 1) {
        if (!name.trim() || !bio || !education) {
          throw new Error("Isi nama, bio, dan pendidikan Anda.");
        }
        await updateName(name.trim());
        await upsertTutorProfile({ bio, education });
      } else if (step === 2) {
        if (subjectIds.length === 0 || gradeLevelIds.length === 0) {
          throw new Error("Pilih minimal satu mata pelajaran dan jenjang.");
        }
        await upsertTutorProfile({ subjectIds, gradeLevelIds });
      } else if (step === 3) {
        const rate = Number(hourlyRate);
        if (!rate || rate <= 0 || teachingModes.length === 0 || !city) {
          throw new Error("Lengkapi tarif, mode mengajar, dan kota.");
        }
        await upsertTutorProfile({ hourlyRate: rate, teachingModes, city });
      }
      setStep((s) => (s + 1) as Step);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalSubmit() {
    setError(null);
    if (!ktpFile) {
      setError("Unggah foto KTP untuk verifikasi.");
      return;
    }
    setSaving(true);
    try {
      await uploadTutorDocument("ktp", ktpFile);
      if (diplomaFile) {
        await uploadTutorDocument("diploma", diplomaFile);
      }
      await submitTutorProfileForReview();
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim profil untuk verifikasi.");
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(setter: (f: File | null) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => setter(e.target.files?.[0] ?? null);
  }

  async function handleSaveEdits() {
    setError(null);
    setSaved(false);
    if (!name.trim() || !bio || !education) {
      setError("Isi nama, bio, dan pendidikan Anda.");
      return;
    }
    if (subjectIds.length === 0 || gradeLevelIds.length === 0) {
      setError("Pilih minimal satu mata pelajaran dan jenjang.");
      return;
    }
    const rate = Number(hourlyRate);
    if (!rate || rate <= 0 || teachingModes.length === 0 || !city) {
      setError("Lengkapi tarif, mode mengajar, dan kota.");
      return;
    }
    setSaving(true);
    try {
      await updateName(name.trim());
      await upsertTutorProfile({
        bio,
        education,
        subjectIds,
        gradeLevelIds,
        hourlyRate: rate,
        teachingModes,
        city,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingOptions) return <LoadingSpinner label="Memuat pilihan..." />;

  // A verified tutor still needs to be able to add subjects, adjust their
  // rate, etc. later on - this isn't a one-time onboarding wizard for them
  // anymore, so every field renders at once with a single save action
  // instead of the step-by-step first-time flow below.
  if (verificationStatus === "VERIFIED") {
    return (
      <div className="flex w-full max-w-md flex-col gap-5">
        <p className="text-center text-sm text-muted-foreground">
          Profil Anda sudah terverifikasi. Perubahan tersimpan langsung tanpa perlu verifikasi ulang.
        </p>

        <div className="flex flex-col gap-4">
          <Input label="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label htmlFor="bio-edit" className="text-sm font-medium text-foreground">
              Bio singkat
            </label>
            <textarea
              id="bio-edit"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input p-3"
            />
          </div>
          <Input
            label="Latar belakang pendidikan"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          />

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Mata pelajaran yang diajarkan
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  aria-pressed={subjectIds.includes(s.id)}
                  onClick={() => toggle(subjectIds, s.id, setSubjectIds)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    subjectIds.includes(s.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Jenjang yang diajarkan
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {gradeLevels.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  aria-pressed={gradeLevelIds.includes(g.id)}
                  onClick={() => toggle(gradeLevelIds, g.id, setGradeLevelIds)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    gradeLevelIds.includes(g.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </fieldset>

          <Input
            label="Tarif per jam (Rp)"
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Mode mengajar</legend>
            <div className="mt-2 flex gap-4">
              {(["ONLINE", "OFFLINE"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={teachingModes.includes(mode)}
                    onChange={() => toggle(teachingModes, mode, setTeachingModes)}
                  />
                  {mode === "ONLINE" ? "Online" : "Tatap muka"}
                </label>
              ))}
            </div>
          </fieldset>
          <Input label="Kota" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && <p className="text-sm text-success-600">Perubahan disimpan.</p>}

        <Button type="button" onClick={handleSaveEdits} disabled={saving} className="w-full">
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5">
      {verificationStatus === "REJECTED" ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">Profil sebelumnya ditolak</p>
          {rejectionReason && <p className="text-destructive">{rejectionReason}</p>}
          <p className="text-muted-foreground">Perbaiki data di bawah, lalu kirim ulang.</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Profil Anda akan ditinjau oleh admin setelah dikirim.
        </p>
      )}
      <p className="text-center text-sm text-muted-foreground">Langkah {step} dari 4</p>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Input label="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label htmlFor="bio" className="text-sm font-medium text-foreground">
              Bio singkat
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input p-3"
            />
          </div>
          <Input
            label="Latar belakang pendidikan"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Mata pelajaran yang diajarkan
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  aria-pressed={subjectIds.includes(s.id)}
                  onClick={() => toggle(subjectIds, s.id, setSubjectIds)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    subjectIds.includes(s.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Jenjang yang diajarkan
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {gradeLevels.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  aria-pressed={gradeLevelIds.includes(g.id)}
                  onClick={() => toggle(gradeLevelIds, g.id, setGradeLevelIds)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    gradeLevelIds.includes(g.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Input
            label="Tarif per jam (Rp)"
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Mode mengajar</legend>
            <div className="mt-2 flex gap-4">
              {(["ONLINE", "OFFLINE"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={teachingModes.includes(mode)}
                    onChange={() => toggle(teachingModes, mode, setTeachingModes)}
                  />
                  {mode === "ONLINE" ? "Online" : "Tatap muka"}
                </label>
              ))}
            </div>
          </fieldset>
          <Input label="Kota" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="ktp" className="text-sm font-medium text-foreground">
              Foto KTP (wajib)
            </label>
            <input
              id="ktp"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange(setKtpFile)}
              className="mt-1 w-full text-sm"
            />
          </div>
          <div>
            <label htmlFor="diploma" className="text-sm font-medium text-foreground">
              Ijazah (opsional)
            </label>
            <input
              id="diploma"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange(setDiplomaFile)}
              className="mt-1 w-full text-sm"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        {step > 1 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((s) => (s - 1) as Step)}
            disabled={saving}
          >
            Kembali
          </Button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <Button type="button" onClick={saveStepAndAdvance} disabled={saving}>
            {saving ? "Menyimpan..." : "Lanjut"}
          </Button>
        ) : (
          <Button type="button" onClick={handleFinalSubmit} disabled={saving}>
            {saving ? "Mengirim..." : "Kirim untuk verifikasi"}
          </Button>
        )}
      </div>
    </div>
  );
}
