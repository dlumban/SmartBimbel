import { describe, expect, it } from "vitest";
import { formatIDR } from "./format";

describe("formatIDR", () => {
  it("formats whole rupiah amounts with the Rp prefix and thousands separators", () => {
    expect(formatIDR(150000)).toBe("Rp 150.000");
  });

  it("formats zero", () => {
    expect(formatIDR(0)).toBe("Rp 0");
  });

  it("formats large amounts", () => {
    expect(formatIDR(12500000)).toBe("Rp 12.500.000");
  });
});
