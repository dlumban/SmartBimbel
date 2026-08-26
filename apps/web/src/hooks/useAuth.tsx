"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { firebaseAuth } from "../lib/firebase";
import { exchangeSession, SessionUser } from "../lib/api";

interface AuthContextValue {
  firebaseUser: User | null;
  sessionUser: SessionUser | null;
  loading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncSession = useCallback(async (user: User | null) => {
    if (!user) {
      setSessionUser(null);
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const session = await exchangeSession(idToken);
      setSessionUser(session);
      setError(null);
    } catch {
      setError("Gagal menyinkronkan sesi. Silakan coba masuk kembali.");
      setSessionUser(null);
    }
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      // Firebase isn't provisioned yet (docs/third-party-setup.md) - there's
      // no auth state to listen for, so just stop showing a loading state.
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      // Reset to loading for every auth change, not just the first one -
      // otherwise a page that redirects on `!loading && !sessionUser` (e.g.
      // "/") sees the stale false/null combo left over from the previous
      // state during the syncSession() await below and bounces the user
      // straight back to /login before the session finishes syncing.
      setLoading(true);
      setFirebaseUser(user);
      await syncSession(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [syncSession]);

  const refreshSession = useCallback(async () => {
    await syncSession(firebaseAuth?.currentUser ?? null);
  }, [syncSession]);

  const signOut = useCallback(async () => {
    if (!firebaseAuth) return;
    await firebaseSignOut(firebaseAuth);
    setSessionUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ firebaseUser, sessionUser, loading, error, refreshSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
