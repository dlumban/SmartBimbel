"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "@smartbimbel/ui";
import { firebaseAuth } from "../lib/firebase";
import { trackEvent } from "../lib/analytics";

const NOT_CONFIGURED_MESSAGE =
  "Login belum tersedia - konfigurasi Firebase belum lengkap di server ini.";

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    if (!firebaseAuth) {
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      // Google sign-in doesn't cleanly distinguish a first-time signup
      // from a returning login without an extra round-trip - tracked as
      // "login" either way, a documented simplification.
      void trackEvent("login", { method: "google" });
      onSuccess?.();
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
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

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
