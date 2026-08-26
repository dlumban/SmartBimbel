import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

try {
  // getAuth() validates the API key format eagerly - without this
  // try/catch, Next.js's server-side prerendering crashes the whole build
  // the moment Firebase isn't provisioned (not in this environment - see
  // docs/third-party-setup.md). `auth` is null until real credentials
  // exist; every consumer must handle that. Mirrors apps/web's lib/firebase.ts.
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch {
  app = null;
  auth = null;
}

export const firebaseApp = app;
export const firebaseAuth = auth;
