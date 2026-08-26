"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "../../src/components/LoginForm";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <span className="mb-4 inline-block rounded-full bg-primary-100 px-4 py-1 text-sm font-medium text-primary-700">
          SmartBimbel
        </span>
        <h1 className="text-2xl font-bold">Masuk atau daftar</h1>
        <p className="mt-1 text-neutral-600">Lanjutkan dengan akun Google Anda.</p>
      </div>
      <LoginForm onSuccess={() => router.push("/")} />
    </main>
  );
}
