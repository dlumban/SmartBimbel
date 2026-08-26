const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "EM", "B", "I", "U", "UL", "OL", "LI", "H2", "H3", "IMG"]);
// Only this inert scheme survives sanitization for an <img> src - never a
// real, browser-fetchable URL. A real src is hydrated client-side after the
// fact (see hydrateAttachmentImages.ts) from an authenticated fetch, so a
// stored `javascript:`/`data:`/external `http(s):` src can never reach the
// DOM here.
const ATTACHMENT_SRC = /^attachment:[a-z0-9]+$/i;
const DROP_WITH_CHILDREN = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT"]);

/**
 * Strips tags/attributes that the session-notes editor never produces, so
 * stored HTML can be rendered without running scripts. Runs in the browser
 * (and jsdom) via a detached template element.
 */
export function sanitizeHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  sanitizeNode(template.content);
  return template.innerHTML;
}

function sanitizeNode(parent: ParentNode): void {
  for (const child of [...parent.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    if (DROP_WITH_CHILDREN.has(el.tagName)) {
      el.remove();
      continue;
    }
    sanitizeNode(el);
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    if (el.tagName === "IMG") {
      const src = el.getAttribute("src");
      const alt = el.getAttribute("alt");
      for (const attr of [...el.attributes]) {
        el.removeAttribute(attr.name);
      }
      if (!src || !ATTACHMENT_SRC.test(src)) {
        el.remove();
        continue;
      }
      el.setAttribute("src", src);
      if (alt) el.setAttribute("alt", alt.slice(0, 200));
      continue;
    }
    for (const attr of [...el.attributes]) {
      el.removeAttribute(attr.name);
    }
  }
}
