"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, CalendarRange, ExternalLink, Home, LogOut, UserCircle2, Users } from "lucide-react";
import { Button } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import type { SessionUser } from "../lib/api";

interface MenuItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const STUDENT_ITEMS: MenuItem[] = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/bookings/calendar", label: "Kalender Sesi", icon: CalendarDays },
];

const TUTOR_ITEMS: MenuItem[] = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/onboarding/profile", label: "Profil Tutor", icon: UserCircle2 },
  { href: "/students", label: "Murid Saya", icon: Users },
  { href: "/bookings/schedule", label: "Jadwalkan Sesi", icon: CalendarPlus },
  { href: "/bookings/schedule/bulk", label: "Jadwalkan Massal", icon: CalendarRange },
];

// apps/web is student/tutor-facing only (PRD - admins use the separate
// apps/admin app) - an ADMIN account has no student/tutor data here, so
// point it at the real app instead of a menu into features it can't use.
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

const ADMIN_ITEMS: MenuItem[] = [{ href: ADMIN_URL, label: "Buka Admin Panel", icon: ExternalLink }];

function itemsFor(sessionUser: SessionUser | null): MenuItem[] {
  if (!sessionUser) return [];
  if (sessionUser.role === "TUTOR") return TUTOR_ITEMS;
  if (sessionUser.role === "STUDENT") return STUDENT_ITEMS;
  if (sessionUser.role === "ADMIN") return ADMIN_ITEMS;
  return [];
}

function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/**
 * Renders on every page via app/layout.tsx (not a gate - each page already
 * redirects on its own auth/role requirements per Sprint 1's per-page
 * pattern). From md up, a static bg-sidebar column; below md, a header bar
 * plus a horizontal scrollable nav row - no more slide-in drawer.
 */
export function SiteSidebar() {
  const { sessionUser, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Login and the unauthenticated/loading home spinner have no nav - the
  // leftover guest "Cari Tutor" menu used to flash here while / redirected
  // to /login.
  if (pathname === "/login" || loading || !sessionUser) return null;

  const items = itemsFor(sessionUser);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold text-sidebar-foreground">
          SmartBimbel
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            const itemClassName = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
            }`;
            const content = (
              <>
                <item.icon className="h-4 w-4" />
                {item.label}
              </>
            );
            return isExternal(item.href) ? (
              <a key={item.label} href={item.href} className={itemClassName}>
                {content}
              </a>
            ) : (
              <Link key={item.label} href={item.href} className={itemClassName}>
                {content}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground">
            {sessionUser.name ?? sessionUser.email ?? "Akun"}
          </p>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="flex flex-col md:hidden">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-foreground">
            SmartBimbel
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        {items.length > 0 && (
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2">
            {items.map((item) => {
              const isActive = pathname === item.href;
              const itemClassName = `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
              }`;
              return isExternal(item.href) ? (
                <a key={item.label} href={item.href} className={itemClassName}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} href={item.href} className={itemClassName}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}
