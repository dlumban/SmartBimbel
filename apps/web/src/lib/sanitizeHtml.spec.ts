import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("keeps allowed formatting tags and drops scripts", () => {
    expect(sanitizeHtml('<p>Hello <strong>world</strong></p><script>alert(1)</script>')).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });

  it("strips attributes", () => {
    expect(sanitizeHtml('<p onclick="alert(1)">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("keeps an img with a valid attachment: src and alt", () => {
    expect(sanitizeHtml('<img src="attachment:abc123" alt="Worksheet">')).toBe(
      '<img src="attachment:abc123" alt="Worksheet">',
    );
  });

  it("drops a javascript: src on an img", () => {
    expect(sanitizeHtml('<img src="javascript:alert(1)" alt="x">')).toBe("");
  });

  it("drops a data: src on an img", () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">')).toBe("");
  });

  it("drops an external http(s): src on an img", () => {
    expect(sanitizeHtml('<img src="https://evil.example/x.png">')).toBe("");
  });

  it("drops an img with no src", () => {
    expect(sanitizeHtml("<img>")).toBe("");
  });

  it("strips other attributes (e.g. onerror) from an otherwise-valid img", () => {
    expect(
      sanitizeHtml('<img src="attachment:abc123" onerror="alert(1)" width="9999">'),
    ).toBe('<img src="attachment:abc123">');
  });

  it("caps alt text length at 200 chars", () => {
    const longAlt = "a".repeat(250);
    const result = sanitizeHtml(`<img src="attachment:abc123" alt="${longAlt}">`);
    expect(result).toBe(`<img src="attachment:abc123" alt="${"a".repeat(200)}">`);
  });
});
