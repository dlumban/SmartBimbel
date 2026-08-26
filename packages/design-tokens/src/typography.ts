// Not `as const`: Tailwind's fontFamily type expects mutable string[] values.
export const fontFamily: Record<"sans", string[]> = {
  sans: [
    "Inter",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
};

// Type scale in rem, base 16px. Kept short deliberately - extend only when a
// screen actually needs a size not covered here.
export const fontSize = {
  xs: "0.75rem", // 12px - captions, badges
  sm: "0.875rem", // 14px - secondary text, form labels
  base: "1rem", // 16px - body text
  lg: "1.125rem", // 18px - emphasized body
  xl: "1.25rem", // 20px - card titles
  "2xl": "1.5rem", // 24px - section headings
  "3xl": "1.875rem", // 30px - screen titles
  "4xl": "2.25rem", // 36px - marketing/hero
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
