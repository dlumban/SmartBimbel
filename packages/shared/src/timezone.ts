/**
 * Indonesia spans three time zones (PRD §6.1.C). Availability slot times
 * are stored as plain "HH:mm" strings interpreted in the tutor's local
 * zone (see AvailabilitySlot in the Prisma schema) - this resolves which
 * zone that is from the tutor's registered city, and converts to/from UTC
 * for anything that needs a real instant (e.g. comparing against "now").
 *
 * Not exhaustive - covers WIB's PRD-named launch cities plus enough WITA/WIT
 * cities to prove the three-zone handling is actually correct, since none of
 * the PRD's launch cities are outside WIB. Defaults to WIB (where the large
 * majority of Indonesia's population and this platform's launch cities are)
 * for any unrecognized city, rather than failing.
 */
export type IndonesianTimezone = "WIB" | "WITA" | "WIT";

const UTC_OFFSET_HOURS: Record<IndonesianTimezone, number> = {
  WIB: 7,
  WITA: 8,
  WIT: 9,
};

const CITY_TIMEZONE: Record<string, IndonesianTimezone> = {
  // WIB (UTC+7) - Java, Sumatra, West/Central Kalimantan
  "jakarta pusat": "WIB",
  "jakarta selatan": "WIB",
  "jakarta utara": "WIB",
  "jakarta barat": "WIB",
  "jakarta timur": "WIB",
  bogor: "WIB",
  depok: "WIB",
  tangerang: "WIB",
  bekasi: "WIB",
  bandung: "WIB",
  surabaya: "WIB",
  medan: "WIB",
  yogyakarta: "WIB",
  semarang: "WIB",
  palembang: "WIB",
  // WITA (UTC+8) - Bali, Nusa Tenggara, South/East Kalimantan, Sulawesi
  denpasar: "WITA",
  makassar: "WITA",
  balikpapan: "WITA",
  manado: "WITA",
  mataram: "WITA",
  // WIT (UTC+9) - Maluku, Papua
  jayapura: "WIT",
  ambon: "WIT",
  sorong: "WIT",
};

export function getTimezoneForCity(city: string | null | undefined): IndonesianTimezone {
  if (!city) return "WIB";
  return CITY_TIMEZONE[city.trim().toLowerCase()] ?? "WIB";
}

export function utcOffsetHours(tz: IndonesianTimezone): number {
  return UTC_OFFSET_HOURS[tz];
}

/** Converts a local "HH:mm" in the given zone to "HH:mm" UTC (for display/sorting only - no date component). */
export function localTimeToUtc(localHHmm: string, tz: IndonesianTimezone): string {
  const [h, m] = localHHmm.split(":").map(Number);
  const totalMinutes = (h * 60 + m - utcOffsetHours(tz) * 60 + 24 * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Converts a "HH:mm" UTC time to local "HH:mm" in the given zone. */
export function utcTimeToLocal(utcHHmm: string, tz: IndonesianTimezone): string {
  const [h, m] = utcHHmm.split(":").map(Number);
  const totalMinutes = (h * 60 + m + utcOffsetHours(tz) * 60) % (24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Combines a calendar date + local "HH:mm" in the given zone into a real
 * UTC Date instant - unlike localTimeToUtc/utcTimeToLocal (which only wrap
 * within a 24h clock face for display), this does real millisecond
 * arithmetic so a local time that rolls into the previous/next UTC day
 * (e.g. WIT 07:00 is UTC 22:00 the day before) comes out correct. Used for
 * anything that needs an actual bookable instant (Task 3.2's `scheduledAt`).
 */
export function combineLocalDateTimeToUtc(
  isoDate: string,
  localHHmm: string,
  tz: IndonesianTimezone,
): Date {
  const naiveUtc = new Date(`${isoDate}T${localHHmm}:00.000Z`);
  return new Date(naiveUtc.getTime() - utcOffsetHours(tz) * 60 * 60 * 1000);
}
