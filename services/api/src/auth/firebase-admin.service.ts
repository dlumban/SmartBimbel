import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { DecodedIdToken, getAuth } from "firebase-admin/auth";

/**
 * Thin wrapper around the Firebase Admin SDK. Initializes lazily (on first
 * use, not at boot) so the API can start and serve every non-auth route even
 * when FIREBASE_* env vars aren't configured yet (see docs/third-party-setup.md
 * - Firebase isn't provisioned in this environment). Auth-dependent routes
 * fail with a clear 503 instead of the whole process crashing on boot.
 */
@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  private getApp(): App {
    if (this.app) return this.app;

    const projectId = this.config.get<string>("FIREBASE_PROJECT_ID");
    const clientEmail = this.config.get<string>("FIREBASE_CLIENT_EMAIL");
    const privateKey = this.config.get<string>("FIREBASE_PRIVATE_KEY");

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        "Firebase Admin is not configured (FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY missing) - auth-dependent routes will return 503.",
      );
      throw new ServiceUnavailableException(
        "Authentication is not configured on this server yet.",
      );
    }

    const existing = getApps()[0];
    this.app =
      existing ??
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          // .env stores literal "\n" - convert back to real newlines.
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });

    return this.app;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    const bypassed = this.tryE2EBypass(idToken);
    if (bypassed) return bypassed;
    return getAuth(this.getApp()).verifyIdToken(idToken);
  }

  // Access-link redemption (admin panel "Add Student" flow) mints a client
  // SDK sign-in token for a given uid - the client exchanges it for a real
  // ID token via signInWithCustomToken, which then flows through the exact
  // same /auth/session exchange as any other sign-in method.
  async createCustomToken(uid: string): Promise<string> {
    return getAuth(this.getApp()).createCustomToken(uid);
  }

  /**
   * Test-only escape hatch for Playwright E2E (Task 8.1): there's no real
   * Firebase project in this environment, so a live server process has no
   * way to mint a token a genuine user could sign in with. Mirrors exactly
   * what the Jest e2e suite already does (mocking this same method) but
   * made reachable over HTTP for a real running server - never a general
   * auth bypass.
   *
   * Double-gated: requires E2E_AUTH_BYPASS_SECRET to be explicitly set
   * (unset in every real .env, never in production config) AND
   * NODE_ENV !== "production", so a misconfigured prod deploy still can't
   * activate it even if the env var somehow leaked in. Tokens must be
   * prefixed "E2E." - anything else always falls through to real Firebase
   * verification untouched.
   */
  private tryE2EBypass(idToken: string): DecodedIdToken | null {
    const secret = this.config.get<string>("E2E_AUTH_BYPASS_SECRET");
    if (!secret || process.env.NODE_ENV === "production" || !idToken.startsWith("E2E.")) {
      return null;
    }

    let payload: { secret?: string; uid?: string; phone_number?: string; email?: string };
    try {
      payload = JSON.parse(Buffer.from(idToken.slice("E2E.".length), "base64url").toString("utf8"));
    } catch {
      throw new Error("Malformed E2E bypass token.");
    }

    if (payload.secret !== secret || !payload.uid) {
      throw new Error("Invalid E2E bypass token.");
    }

    return {
      uid: payload.uid,
      phone_number: payload.phone_number,
      email: payload.email,
    } as DecodedIdToken;
  }
}
