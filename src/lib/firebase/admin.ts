import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./env";

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  // With FIREBASE_AUTH_EMULATOR_HOST set, the admin SDK only needs a project id.
  return initializeApp(
    sa
      ? { credential: cert(JSON.parse(sa)) }
      : { projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
  );
}

export const adminAuth = () => getAuth(adminApp());

export interface AuthUser {
  uid: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/** The verified user from the session cookie, or null. Checks revocation, so sign-out takes effect everywhere. */
export async function getSessionUser(): Promise<AuthUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const t = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: t.uid,
      email: t.email ?? "",
      name: typeof t.name === "string" ? t.name : null,
      picture: typeof t.picture === "string" ? t.picture : null,
    };
  } catch {
    return null;
  }
}
