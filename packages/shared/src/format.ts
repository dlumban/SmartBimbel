/** Formats a rupiah amount (integer, no subunits) as "Rp 150.000". */
export function formatIDR(amount: number): string {
  // Intl (id-ID) inserts a non-breaking space between "Rp" and the number;
  // normalize all whitespace to a plain ASCII space for predictable output.
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\s/g, " ");
}
