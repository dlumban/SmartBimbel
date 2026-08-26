"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { firebaseAuth } from "../lib/firebase";
import { redeemAccessLink } from "../lib/api";

const NOT_CONFIGURED_MESSAGE =
  "Login belum tersedia - konfigurasi Firebase belum lengkap di server ini.";

/**
 * Landing point for a student access link. Redeeming it returns a Firebase
 * custom token; the link stays valid until deactivated (no time TTL, not
 * burned on use). useAuth's onAuthStateChanged listener then runs the normal
 * /auth/session exchange automatically.
 */
export function AccessLinkRedeemer({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // StrictMode/dev double-invokes effects - without this, redeem would run
  // twice in dev (harmless now that links are reusable, but still wasteful).
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!firebaseAuth) {
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }

    redeemAccessLink(token)
      .then(({ customToken }) => signInWithCustomToken(firebaseAuth!, customToken))
      .then(() => router.replace("/"))
      .catch((e) => setError(e instanceof Error ? e.message : "Link tidak valid."));
  }, [token, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <ErrorState title="Link tidak dapat digunakan" description={error} />
        <Link href="/login" className="text-primary hover:underline">
          Masuk secara manual
        </Link>
      </div>
    );
  }

  return <LoadingSpinner label="Memproses link akses..." />;
}
