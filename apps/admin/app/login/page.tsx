"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../../src/hooks/useAuth";
import { AdminLoginForm } from "../../src/components/AdminLoginForm";

export default function AdminLoginPage() {
  const { sessionUser, loading, isAdmin, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && sessionUser && isAdmin) {
      router.replace("/");
    }
  }, [loading, sessionUser, isAdmin, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  // Signed in via Firebase, session synced, but not an ADMIN account -
  // Task 7.1's AC: only ADMIN-role users can log into this app.
  const notAnAdmin = sessionUser && !isAdmin;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          SmartBimbel Admin
        </span>
        <h1 className="text-2xl font-bold">Masuk ke Panel Admin</h1>
        <p className="mt-1 text-muted-foreground">Khusus untuk staf SmartBimbel.</p>
      </div>
      {notAnAdmin && (
        <p className="max-w-sm rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          Akun ini tidak memiliki akses admin.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <AdminLoginForm onSuccess={() => router.push("/")} />
    </main>
  );
}
