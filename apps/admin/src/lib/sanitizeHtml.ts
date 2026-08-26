const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "EM", "B", "I", "U", "UL", "OL", "LI", "H2", "H3"]);
const DROP_WITH_CHILDREN = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT"]);

/** Strips tags/attributes the session-notes editor never produces. */
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
    for (const attr of [...el.attributes]) {
      el.removeAttribute(attr.name);
    }
  }
}
