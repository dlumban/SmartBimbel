import { parsePhoneNumberWithError } from "libphonenumber-js";

/**
 * Normalizes a phone number to E.164 (+62...). Defaults to Indonesia (ID)
 * when the input has no country code, since that's this platform's only
 * launch market. Returns null for anything unparseable rather than throwing
 * - callers decide whether a missing/invalid phone is fatal.
 */
export function normalizePhoneToE164(raw: string): string | null {
  try {
    const parsed = parsePhoneNumberWithError(raw, "ID");
    return parsed.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}
