import { describe, expect, it } from "vitest";
import { distanceKm, getCityCoordinates, SUPPORTED_CITIES } from "./cities";

describe("getCityCoordinates", () => {
  it("resolves a supported city case-insensitively", () => {
    expect(getCityCoordinates("bandung")).toEqual({ name: "Bandung", lat: -6.9175, lng: 107.6191 });
    expect(getCityCoordinates("BANDUNG")).toEqual(getCityCoordinates("Bandung"));
  });

  it("returns null for an unsupported city", () => {
    expect(getCityCoordinates("Atlantis")).toBeNull();
  });

  it("every supported city has valid Indonesia-range coordinates", () => {
    for (const city of SUPPORTED_CITIES) {
      expect(city.lat).toBeGreaterThan(-11);
      expect(city.lat).toBeLessThan(6);
      expect(city.lng).toBeGreaterThan(95);
      expect(city.lng).toBeLessThan(141);
    }
  });
});

describe("distanceKm", () => {
  it("returns 0 for identical points", () => {
    const jakarta = getCityCoordinates("Jakarta Selatan")!;
    expect(distanceKm(jakarta, jakarta)).toBeCloseTo(0, 5);
  });

  it("computes a realistic distance between Jakarta and Bandung (~110-150km)", () => {
    const jakarta = getCityCoordinates("Jakarta Selatan")!;
    const bandung = getCityCoordinates("Bandung")!;
    const km = distanceKm(jakarta, bandung);
    expect(km).toBeGreaterThan(100);
    expect(km).toBeLessThan(160);
  });

  it("is symmetric", () => {
    const a = getCityCoordinates("Medan")!;
    const b = getCityCoordinates("Surabaya")!;
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });

  it("nearby cities are closer than far ones", () => {
    const jakartaSelatan = getCityCoordinates("Jakarta Selatan")!;
    const depok = getCityCoordinates("Depok")!;
    const medan = getCityCoordinates("Medan")!;
    expect(distanceKm(jakartaSelatan, depok)).toBeLessThan(
      distanceKm(jakartaSelatan, medan),
    );
  });
});
