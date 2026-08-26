/**
 * Placeholder brand palette for SmartBimbel. Swap these hex values once real
 * brand colors exist — every consumer (Tailwind configs, Flutter theme) reads
 * from this single source, so a rebrand is a one-file change.
 *
 * Scales follow a 50 (lightest) -> 900 (darkest) convention. Primary/accent
 * scales are close derivatives of Tailwind's own indigo/orange scales, which
 * are already vetted for WCAG AA contrast at the 600-700 steps against white.
 */
export const colors = {
  primary: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },
  accent: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
  },
  success: {
    50: "#ecfdf5",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
  },
  warning: {
    50: "#fffbeb",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
  },
  danger: {
    50: "#fef2f2",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
  },
  neutral: {
    0: "#ffffff",
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
} as const;

export type ColorScale = typeof colors;

/**
 * Semantic slot -> scale-step mapping used for the shadcn-style CSS custom
 * properties declared in each app's globals.css (--background, --primary,
 * --sidebar-accent, etc). Keep this comment in sync with those :root blocks
 * so the two never silently drift apart.
 *
 *   --background            neutral.50
 *   --foreground            neutral.900
 *   --card / --popover      neutral.0
 *   --primary / --ring      primary.600
 *   --secondary / --muted   neutral.100
 *   --muted-foreground      neutral.500
 *   --accent                accent.500
 *   --accent-foreground     accent.900
 *   --destructive           danger.600
 *   --border / --input      neutral.200
 *   --sidebar               neutral.0
 *   --sidebar-accent        primary.100
 *   --sidebar-accent-fg     primary.700
 */
