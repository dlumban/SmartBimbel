import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // Firebase Analytics (Task 8.5) - bundled free with the same Firebase
  // project used for auth, per the task's own note. Optional: analytics.ts
  // simply no-ops if this isn't set, same gate as everything else here.
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

try {
  // getAuth() validates the API key format eagerly (not just on network
  // calls, contrary to what initializeApp() alone does) - without this
  // try/catch, Next.js's server-side prerendering of every page crashed the
  // whole build the moment Firebase isn't provisioned (see
  // docs/third-party-setup.md - it isn't, in this environment). `auth` is
  // null until real credentials exist; every consumer must handle that.
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch {
  app = null;
  auth = null;
}

export const firebaseApp = app;
export const firebaseAuth = auth;
