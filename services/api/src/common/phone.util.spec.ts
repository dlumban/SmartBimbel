import { normalizePhoneToE164 } from "./phone.util";

describe("normalizePhoneToE164", () => {
  it("normalizes a local Indonesian number to E.164", () => {
    expect(normalizePhoneToE164("081234500001")).toBe("+6281234500001");
  });

  it("passes through an already-E.164 number unchanged", () => {
    expect(normalizePhoneToE164("+6281234500001")).toBe("+6281234500001");
  });

  it("returns null for an unparseable number", () => {
    expect(normalizePhoneToE164("not-a-phone")).toBeNull();
  });

  it("returns null for a too-short number", () => {
    expect(normalizePhoneToE164("123")).toBeNull();
  });
});
