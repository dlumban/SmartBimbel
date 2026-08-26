"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarDays,
  LogOut,
  Package,
  Receipt,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { href: "/", label: "Analitik", icon: BarChart3 },
  { href: "/tutors", label: "Persetujuan Tutor", icon: UserCheck },
  { href: "/users", label: "Pengguna", icon: Users },
  { href: "/bookings/calendar", label: "Kalender Sesi", icon: CalendarDays },
  { href: "/bookings", label: "Booking", icon: Calendar },
  { href: "/packages", label: "Paket Les", icon: Package },
  { href: "/transactions", label: "Transaksi", icon: Receipt },
  { href: "/payouts", label: "Pencairan Dana", icon: Wallet },
  { href: "/disputes", label: "Sengketa & Laporan", icon: AlertTriangle },
];

function navItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  // Exact match for list vs calendar so /bookings doesn't light up on /bookings/calendar.
  if (href === "/bookings") return pathname === "/bookings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shell layout (Task 7.1) - every authenticated admin screen renders
 * inside this: nav + top bar with the signed-in admin's name/sub-role and
 * a sign-out action. Redirects anyone who isn't role: "ADMIN" straight to
 * /login (Task 7.1's AC: "only users with an ADMIN role... can log in").
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { sessionUser, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!sessionUser || !isAdmin) {
      router.replace("/login");
    }
  }, [loading, sessionUser, isAdmin, router]);

  if (loading || !sessionUser || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-6 py-3">
          <span className="font-semibold text-primary">SmartBimbel Admin</span>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {sessionUser.name ?? sessionUser.email ?? "Admin"} &middot;{" "}
              {sessionUser.adminRole === "SUPER_ADMIN" ? "Super Admin" : "Support"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                void signOut().then(() => router.push("/login"));
              }}
            >
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-6 pb-2 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${
                navItemActive(item.href, pathname)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
