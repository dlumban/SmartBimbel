"use client";

import { FormEvent, useState } from "react";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { Button, Input } from "@smartbimbel/ui";
import { firebaseAuth } from "../lib/firebase";

const NOT_CONFIGURED_MESSAGE =
  "Login belum tersedia - konfigurasi Firebase belum lengkap di server ini.";

// No self-registration here, unlike apps/web's LoginForm - admin accounts
// are created directly (Sprint 1's own precedent: "Admins aren't
// self-service"), never via sign-up. This form only ever signs an
// *existing* Firebase user in; whether that account actually has an ADMIN
// role is checked afterward by AdminShell.
export function AdminLoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firebaseAuth) {
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      onSuccess?.();
    } catch {
      setError("Email atau kata sandi salah.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    if (!firebaseAuth) {
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      onSuccess?.();
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "auth/unauthorized-domain") {
        setError(
          "Domain ini belum diizinkan di Firebase (Authentication → Settings → Authorized domains).",
        );
      } else if (code === "auth/popup-blocked") {
        setError("Popup Google diblokir browser. Izinkan popup lalu coba lagi.");
      } else if (code === "auth/popup-closed-by-user") {
        setError("Login Google dibatalkan.");
      } else {
        setError(code ? `Gagal masuk dengan Google (${code}).` : "Gagal masuk dengan Google.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Button type="button" variant="secondary" onClick={handleGoogleSignIn} disabled={submitting}>
        Lanjutkan dengan Google
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-px flex-1 bg-muted" />
        atau
        <div className="h-px flex-1 bg-muted" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Kata sandi"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting}>
          Masuk
        </Button>
      </form>
    </div>
  );
}
