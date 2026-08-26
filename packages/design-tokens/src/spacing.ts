// 4px base spacing scale, in rem.
export const spacing = {
  0: "0",
  1: "0.25rem", // 4px
  2: "0.5rem", // 8px
  3: "0.75rem", // 12px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  8: "2rem", // 32px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
  16: "4rem", // 64px
} as const;

// Derived from a single --radius CSS var (set in each app's globals.css) so
// the whole scale can be tuned from one place, matching shadcn/ui convention.
export const radius = {
  none: "0",
  sm: "calc(var(--radius) - 4px)",
  md: "calc(var(--radius) - 2px)",
  lg: "var(--radius)",
  xl: "calc(var(--radius) + 4px)",
  full: "9999px",
} as const;

// Minimum tap target per PRD §7 mobile-first requirement (44px is the
// commonly cited accessible minimum for touch targets).
export const minTapTarget = "2.75rem"; // 44px
