"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { AUTH_EMULATOR_HOST, firebaseConfig } from "./env";

let auth: Auth | undefined;

const LOOPBACK = new Set(["localhost", "127.0.0.1"]);

/**
 * Emulator URL on the same loopback hostname as the page. "localhost" and "127.0.0.1" are different sites, so with
 * the app on localhost:3000 and the emulator on 127.0.0.1:9099 the emulator's auth iframe is cross-site: the popup
 * can't find it in window.opener.frames and fails with "Auth Emulator Internal Error: No matching frame".
 */
export function emulatorUrl(host: string, pageHostname?: string): string {
  const i = host.lastIndexOf(":");
  const name = i === -1 ? host : host.slice(0, i);
  const port = i === -1 ? "" : host.slice(i);
  const sameSite = pageHostname && LOOPBACK.has(name) && LOOPBACK.has(pageHostname) ? pageHostname : name;
  return `http://${sameSite}${port}`;
}

export function firebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
  if (AUTH_EMULATOR_HOST) {
    const page = typeof window !== "undefined" ? window.location.hostname : undefined;
    connectAuthEmulator(auth, emulatorUrl(AUTH_EMULATOR_HOST, page), { disableWarnings: true });
  }
  return auth;
}
