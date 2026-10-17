/**
 * Serves Firebase Auth's sign-in helper (/__/auth/*) from the app's own domain. Browsers that block third-party
 * storage (iOS Safari/WebKit) fail with auth/network-request-failed when it lives on <project>.firebaseapp.com.
 * Pair with NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = the app's domain and that domain's /__/auth/handler registered as an
 * OAuth redirect URI. https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
export function authProxyRewrites(projectId: string | undefined) {
  if (!projectId) return [];
  return [{ source: "/__/auth/:path*", destination: `https://${projectId}.firebaseapp.com/__/auth/:path*` }];
}
