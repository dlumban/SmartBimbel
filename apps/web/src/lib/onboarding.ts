import { SessionUser } from "./api";

/**
 * Single source of truth for "where should this user land right now" -
 * used by the homepage (and anywhere else that needs to redirect into the
 * right onboarding step) so the routing rules never drift between pages.
 * Returns null when the user should stay where they are.
 */
export function getOnboardingRedirect(sessionUser: SessionUser | null): string | null {
  if (!sessionUser) return null; // caller decides how to handle logged-out
  if (!sessionUser.role) return "/onboarding/role";
  if (!sessionUser.hasProfile) return "/onboarding/profile";
  return null;
}
