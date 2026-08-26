import { describe, expect, it } from "vitest";
import {
  combineLocalDateTimeToUtc,
  getTimezoneForCity,
  localTimeToUtc,
  utcOffsetHours,
  utcTimeToLocal,
} from "./timezone";

describe("getTimezoneForCity", () => {
  it("resolves WIB cities", () => {
    expect(getTimezoneForCity("Jakarta Selatan")).toBe("WIB");
    expect(getTimezoneForCity("Medan")).toBe("WIB");
  });

  it("resolves WITA cities", () => {
    expect(getTimezoneForCity("Denpasar")).toBe("WITA");
    expect(getTimezoneForCity("Makassar")).toBe("WITA");
  });

  it("resolves WIT cities", () => {
    expect(getTimezoneForCity("Jayapura")).toBe("WIT");
  });

  it("is case-insensitive", () => {
    expect(getTimezoneForCity("DENPASAR")).toBe("WITA");
  });

  it("defaults to WIB for an unrecognized or missing city", () => {
    expect(getTimezoneForCity("Atlantis")).toBe("WIB");
    expect(getTimezoneForCity(null)).toBe("WIB");
    expect(getTimezoneForCity(undefined)).toBe("WIB");
  });
});

describe("utcOffsetHours", () => {
  it("matches Indonesia's known UTC offsets", () => {
    expect(utcOffsetHours("WIB")).toBe(7);
    expect(utcOffsetHours("WITA")).toBe(8);
    expect(utcOffsetHours("WIT")).toBe(9);
  });
});

describe("localTimeToUtc / utcTimeToLocal", () => {
  it("converts WIB 16:00 to 09:00 UTC and back", () => {
    expect(localTimeToUtc("16:00", "WIB")).toBe("09:00");
    expect(utcTimeToLocal("09:00", "WIB")).toBe("16:00");
  });

  it("converts WITA 16:00 to 08:00 UTC", () => {
    expect(localTimeToUtc("16:00", "WITA")).toBe("08:00");
  });

  it("converts WIT 16:00 to 07:00 UTC", () => {
    expect(localTimeToUtc("16:00", "WIT")).toBe("07:00");
  });

  it("wraps correctly across midnight", () => {
    expect(localTimeToUtc("02:00", "WIB")).toBe("19:00");
    expect(utcTimeToLocal("19:00", "WIB")).toBe("02:00");
  });

  it("a WIB tutor and a WITA tutor at the same local hour are 1 hour apart in UTC", () => {
    const wibUtc = localTimeToUtc("10:00", "WIB");
    const witaUtc = localTimeToUtc("10:00", "WITA");
    const [wibH] = wibUtc.split(":").map(Number);
    const [witaH] = witaUtc.split(":").map(Number);
    expect(wibH - witaH).toBe(1);
  });
});

describe("combineLocalDateTimeToUtc", () => {
  it("combines a WIB date+time into the correct UTC instant", () => {
    const result = combineLocalDateTimeToUtc("2026-08-18", "16:00", "WIB");
    expect(result.toISOString()).toBe("2026-08-18T09:00:00.000Z");
  });

  it("rolls back to the previous UTC day for an early WIT local time", () => {
    // WIT is UTC+9, so 07:00 local on the 18th is 22:00 UTC on the 17th.
    const result = combineLocalDateTimeToUtc("2026-08-18", "07:00", "WIT");
    expect(result.toISOString()).toBe("2026-08-17T22:00:00.000Z");
  });

  it("rolls forward to the next UTC day for a late WIB local time", () => {
    // WIB is UTC+7, so 23:00 local on the 18th is 16:00 UTC on the 18th
    // (no rollover here) but 01:00 local rolls back to the 17th.
    const result = combineLocalDateTimeToUtc("2026-08-18", "01:00", "WIB");
    expect(result.toISOString()).toBe("2026-08-17T18:00:00.000Z");
  });

  it("round-trips through a Date object correctly (no drift)", () => {
    const result = combineLocalDateTimeToUtc("2026-01-01", "00:00", "WIB");
    expect(result.getTime()).toBe(Date.parse("2025-12-31T17:00:00.000Z"));
  });
});
