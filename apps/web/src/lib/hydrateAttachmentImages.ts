import { fetchAttachmentBlob } from "./bookings";

// Turns each inert `attachment:<id>` src (see sanitizeHtml.ts) into a real,
// visible image by fetching it through the authenticated API and swapping in
// an object URL. Safe to call repeatedly on the same DOM - already-hydrated
// images are skipped via the data-hydrated marker.
export async function hydrateAttachmentImages(root: HTMLElement, bookingId: string): Promise<void> {
  const imgs = root.querySelectorAll<HTMLImageElement>('img[src^="attachment:"]');
  for (const img of Array.from(imgs)) {
    const id = img.getAttribute("src")!.slice("attachment:".length);
    if (img.dataset.hydrated === id) continue;
    try {
      const blob = await fetchAttachmentBlob(bookingId, id);
      img.src = URL.createObjectURL(blob);
      img.dataset.hydrated = id;
    } catch {
      // leave the broken-image icon; non-fatal
    }
  }
}
