import { getAnalytics, isSupported, logEvent, Analytics } from "firebase/analytics";
import { firebaseApp } from "./firebase";

let analyticsInstance: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

// Firebase Analytics (Task 8.5's event-tracking plan) - same gated
// pattern as every other third-party integration: no-ops whenever
// `firebaseApp`/`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` are unset (the real
// state in this environment, docs/third-party-setup.md) or when
// `isSupported()` reports the current environment can't run Analytics
// (e.g. during SSR, where this module may still be evaluated).
async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (!firebaseApp || !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    return null;
  }
  if (analyticsInstance) return analyticsInstance;
  if (!initPromise) {
    initPromise = isSupported()
      .then((supported) => {
        if (!supported || !firebaseApp) return null;
        analyticsInstance = getAnalytics(firebaseApp);
        return analyticsInstance;
      })
      .catch(() => null);
  }
  return initPromise;
}

// Funnel events named in Task 8.5's own scope: registration, role
// selection, profile completion, tutor search, booking request/accept/
// pay/complete, review submitted. Firebase's own recommended event names
// are used where one exists (e.g. "sign_up", "search") so they show up
// correctly in Firebase's standard funnel/conversion reports rather than
// as unrecognized custom events. Every caller fires this without
// awaiting it - analytics must never be able to throw into, block, or
// fail the user-facing action it's attached to.
export async function trackEvent(name: string, params?: Record<string, unknown>): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, name, params);
  } catch {
    // Deliberately swallowed - see note above.
  }
}
