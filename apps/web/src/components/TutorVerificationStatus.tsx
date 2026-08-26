"use client";

import { useEffect, useState } from "react";
import { Badge, LoadingSpinner } from "@smartbimbel/ui";
import { getMyTutorProfile, TutorProfile } from "../lib/tutors";

const STATUS_COPY: Record<
  TutorProfile["verificationStatus"],
  { label: string; variant: "warning" | "online" | "neutral" }
> = {
  PENDING: { label: "Menunggu verifikasi", variant: "warning" },
  VERIFIED: { label: "Terverifikasi", variant: "online" },
  REJECTED: { label: "Ditolak", variant: "neutral" },
};

export function TutorVerificationStatus() {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyTutorProfile()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!profile) return null;

  const copy = STATUS_COPY[profile.verificationStatus];

  return (
    <div className="flex flex-col items-center gap-2">
      <Badge variant={copy.variant}>{copy.label}</Badge>
      {profile.verificationStatus === "REJECTED" && (
        <div className="max-w-sm text-center">
          <p className="text-sm text-destructive">Profil Anda ditolak.</p>
          {profile.rejectionReason && (
            <p className="text-sm text-muted-foreground">{profile.rejectionReason}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Perbarui profil Anda dan kirim ulang untuk ditinjau kembali.
          </p>
        </div>
      )}
      {profile.verificationStatus === "PENDING" && (
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Tim kami sedang meninjau profil Anda. Proses ini biasanya memakan waktu 1-2 hari kerja.
        </p>
      )}
    </div>
  );
}
