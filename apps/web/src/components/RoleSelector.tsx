"use client";

import { useState } from "react";
import { Button, Card, CardContent } from "@smartbimbel/ui";
import { setRole } from "../lib/api";
import { trackEvent } from "../lib/analytics";

export function RoleSelector({ onSelected }: { onSelected: () => void }) {
  const [submitting, setSubmitting] = useState<"STUDENT" | "TUTOR" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(role: "STUDENT" | "TUTOR") {
    setError(null);
    setSubmitting(role);
    try {
      await setRole(role);
      void trackEvent("role_selected", { role });
      onSelected();
    } catch {
      setError("Gagal menyimpan pilihan. Silakan coba lagi.");
      setSubmitting(null);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Card
        role="button"
        tabIndex={0}
        onClick={() => choose("STUDENT")}
        className="cursor-pointer text-left hover:shadow-md"
      >
        <CardContent className="pt-6">
          <p className="font-semibold text-foreground">Saya Siswa / Orang Tua</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cari dan pesan tutor privat untuk belajar.
          </p>
        </CardContent>
      </Card>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => choose("TUTOR")}
        className="cursor-pointer text-left hover:shadow-md"
      >
        <CardContent className="pt-6">
          <p className="font-semibold text-foreground">Saya Tutor</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajar siswa dan kelola jadwal Anda.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {submitting && (
        <Button disabled className="w-full">
          Menyimpan...
        </Button>
      )}
    </div>
  );
}
