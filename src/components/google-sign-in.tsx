"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.7 7.5l3.2 2.4C7.8 8 9.7 6.5 12 6.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 8.4 2.5 5.3 4.5 3.7 7.5z" opacity=".9" />
      <path fill="#FBBC05" d="M12 21.5c2.5 0 4.7-.8 6.2-2.3l-3-2.4c-.8.6-1.9 1-3.2 1-3.8 0-5.2-2.6-5.5-4l-3.2 2.5c1.6 3.1 4.8 5.2 8.7 5.2z" opacity=".9" />
      <path fill="#4285F4" d="M21 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.2 3l3 2.4c1.7-1.6 2.7-4.2 2.7-7.7z" />
    </svg>
  );
}

export function GoogleSignIn({ size = "lg" }: { size?: "lg" | "default" }) {
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();

  async function signIn() {
    setLoading(true);
    const next = params.get("next") ?? "/app";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    try {
      const auth = firebaseAuth();
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const res = await fetch("/auth/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: await cred.user.getIdToken() }),
      });
      // The server cookie is the session; drop the client-side Firebase state.
      await signOut(auth).catch(() => {});
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Sign-in failed");
      location.assign(safeNext);
    } catch (e) {
      setLoading(false);
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      toast.error("Sign-in failed", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Button size={size} onClick={signIn} disabled={loading} className="h-11 gap-2.5 rounded-xl px-5 text-[15px] shadow-lg shadow-primary/20">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
      Continue with Google
    </Button>
  );
}
