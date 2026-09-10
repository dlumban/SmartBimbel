import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Booking, fetchAttachmentBlob, listSessionAttachments } from "./bookings";
import { sanitizeHtml } from "./sanitizeHtml";

/** Max display size for report images inside the PDF layout (px). */
const REPORT_IMAGE_MAX_WIDTH_PX = 480;
const REPORT_IMAGE_MAX_HEIGHT_PX = 320;
const LAYOUT_WIDTH_PX = 720;
const LAYOUT_PADDING_PX = 32;

function formatSessionDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

function styleReportImage(img: HTMLImageElement): void {
  img.style.maxWidth = `${REPORT_IMAGE_MAX_WIDTH_PX}px`;
  img.style.maxHeight = `${REPORT_IMAGE_MAX_HEIGHT_PX}px`;
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.objectFit = "contain";
  img.style.display = "block";
  img.style.margin = "10px 0 14px";
  img.removeAttribute("width");
  img.removeAttribute("height");
}

async function hydrateNotesHtml(bookingId: string, notes: string): Promise<string> {
  if (!looksLikeHtml(notes)) {
    return `<p>${escapeHtml(notes)}</p>`;
  }
  const container = document.createElement("div");
  container.innerHTML = sanitizeHtml(notes);
  const imgs = container.querySelectorAll<HTMLImageElement>('img[src^="attachment:"]');
  for (const img of Array.from(imgs)) {
    const id = img.getAttribute("src")!.slice("attachment:".length);
    try {
      const blob = await fetchAttachmentBlob(bookingId, id);
      img.src = await blobToDataUrl(blob);
      styleReportImage(img);
    } catch {
      img.remove();
    }
  }
  return container.innerHTML;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PreparedSection {
  dateLabel: string;
  subjectName: string;
  html: string;
  imageDataUrls: string[];
}

async function prepareSection(booking: Booking): Promise<PreparedSection> {
  const notes = booking.sessionNotes ?? "";
  const html = notes
    ? await hydrateNotesHtml(booking.id, notes)
    : "<p><em>Tidak ada catatan sesi.</em></p>";

  const imageDataUrls: string[] = [];
  try {
    const attachments = await listSessionAttachments(booking.id);
    for (const att of attachments) {
      if (!att.mimeType.startsWith("image/")) continue;
      try {
        const blob = await fetchAttachmentBlob(booking.id, att.id);
        imageDataUrls.push(await blobToDataUrl(blob));
      } catch {
        // skip missing attachment
      }
    }
  } catch {
    // attachments optional
  }

  return {
    dateLabel: formatSessionDateLong(booking.scheduledAt),
    subjectName: booking.subject.name,
    html,
    imageDataUrls,
  };
}

function createLayoutRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.style.width = `${LAYOUT_WIDTH_PX}px`;
  root.style.padding = `${LAYOUT_PADDING_PX}px`;
  root.style.fontFamily = "Georgia, 'Times New Roman', serif";
  root.style.color = "#111";
  root.style.background = "#fff";
  root.style.boxSizing = "border-box";
  return root;
}

function buildTitleBlock(studentName: string): HTMLDivElement {
  const root = createLayoutRoot();
  root.style.paddingBottom = "8px";
  const title = document.createElement("h1");
  title.textContent = `Combined Report — ${studentName}`;
  title.style.fontSize = "22px";
  title.style.margin = "0";
  root.appendChild(title);
  return root;
}

/** One session block: date subtitle + subject + notes + images stay together. */
function buildSectionBlock(section: PreparedSection): HTMLDivElement {
  const root = createLayoutRoot();
  root.style.paddingTop = "12px";
  root.style.paddingBottom = "16px";

  const heading = document.createElement("h2");
  heading.textContent = section.dateLabel;
  heading.style.fontSize = "15px";
  heading.style.margin = "0 0 4px";
  heading.style.borderBottom = "1px solid #ddd";
  heading.style.paddingBottom = "4px";
  root.appendChild(heading);

  const subject = document.createElement("p");
  subject.textContent = section.subjectName;
  subject.style.fontSize = "12px";
  subject.style.color = "#555";
  subject.style.margin = "0 0 10px";
  root.appendChild(subject);

  const body = document.createElement("div");
  body.innerHTML = section.html;
  body.style.fontSize = "13px";
  body.style.lineHeight = "1.55";
  body.style.marginBottom = "12px";
  for (const img of Array.from(body.querySelectorAll("img"))) {
    styleReportImage(img);
  }
  root.appendChild(body);

  for (const dataUrl of section.imageDataUrls) {
    const img = document.createElement("img");
    img.src = dataUrl;
    styleReportImage(img);
    root.appendChild(img);
  }

  return root;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
    ),
  );
  for (const img of imgs) {
    styleReportImage(img);
  }
}

async function captureBlock(root: HTMLElement): Promise<HTMLCanvasElement> {
  await waitForImages(root);
  return html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number): string {
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = Math.max(1, Math.floor(sw));
  pageCanvas.height = Math.max(1, Math.floor(sh));
  const ctx = pageCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create PDF page.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, pageCanvas.width, pageCanvas.height);
  return pageCanvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Places a captured block onto the PDF. If the whole block fits on the
 * remaining page, it stays together (date subtitle never lands alone at the
 * bottom). Oversized blocks start on a fresh page, then continue.
 */
function placeBlockOnPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  state: { y: number; hasContentOnPage: boolean },
  margin: number,
  usableWidth: number,
  usableHeight: number,
  pageHeight: number,
): void {
  const blockHeightMm = (canvas.height * usableWidth) / canvas.width;
  const pxPerMm = canvas.height / blockHeightMm;

  if (blockHeightMm <= usableHeight) {
    if (state.y + blockHeightMm > pageHeight - margin) {
      pdf.addPage();
      state.y = margin;
      state.hasContentOnPage = false;
    }
    const data = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(data, "JPEG", margin, state.y, usableWidth, blockHeightMm);
    state.y += blockHeightMm;
    state.hasContentOnPage = true;
    return;
  }

  // Block taller than one page: start at top so the date subtitle stays
  // with the beginning of the report content.
  if (state.hasContentOnPage) {
    pdf.addPage();
    state.y = margin;
    state.hasContentOnPage = false;
  }

  let renderedPx = 0;
  while (renderedPx < canvas.height) {
    if (state.hasContentOnPage || renderedPx > 0) {
      pdf.addPage();
      state.y = margin;
    }
    const remainingPx = canvas.height - renderedPx;
    const slicePx = Math.min(usableHeight * pxPerMm, remainingPx);
    const sliceMm = slicePx / pxPerMm;
    const data = canvasToJpeg(canvas, 0, renderedPx, canvas.width, slicePx);
    pdf.addImage(data, "JPEG", margin, margin, usableWidth, sliceMm);
    renderedPx += slicePx;
    state.y = margin + sliceMm;
    state.hasContentOnPage = true;
  }
}

/**
 * Builds a multi-page PDF from selected session reports (oldest first).
 * Each session's date subtitle and content are kept on the same page when
 * they fit; oversized sessions start on a new page so the subtitle is never
 * stranded alone.
 */
export async function generateCombinedReportPdf(options: {
  studentName: string;
  bookings: Booking[];
}): Promise<Blob> {
  const sorted = [...options.bookings].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
  if (sorted.length === 0) {
    throw new Error("Select at least one session.");
  }

  const sections = await Promise.all(sorted.map(prepareSection));

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  document.body.appendChild(host);

  try {
    const titleEl = buildTitleBlock(options.studentName);
    host.appendChild(titleEl);
    const titleCanvas = await captureBlock(titleEl);
    titleEl.remove();

    const sectionCanvases: HTMLCanvasElement[] = [];
    for (const section of sections) {
      const el = buildSectionBlock(section);
      host.appendChild(el);
      sectionCanvases.push(await captureBlock(el));
      el.remove();
    }

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const state = { y: margin, hasContentOnPage: false };

    placeBlockOnPdf(pdf, titleCanvas, state, margin, usableWidth, usableHeight, pageHeight);
    for (const canvas of sectionCanvases) {
      placeBlockOnPdf(pdf, canvas, state, margin, usableWidth, usableHeight, pageHeight);
    }

    return pdf.output("blob");
  } finally {
    host.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
