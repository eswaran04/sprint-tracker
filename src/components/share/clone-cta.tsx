import { Copy } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Button } from "@/components/ui/button";

/** "Clone this Sprint": signed-in users go straight to the clone page; others sign in with Google first. */
export function CloneCta({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const href = `/app/clone/${slug}`;
  return (
    <div className="flex flex-col items-center gap-2">
      {signedIn ? (
        <Button asChild size="lg" className="h-11 gap-2.5 rounded-xl px-5 text-[15px] shadow-lg shadow-primary/20">
          <Link href={href}><Copy /> Clone this Sprint</Link>
        </Button>
      ) : (
        <Suspense>
          <GoogleSignIn next={href} label="Clone this Sprint" />
        </Suspense>
      )}
      <p className="text-xs text-muted-foreground">
        {signedIn ? "Copies the roadmap into your account, starting today." : "Free · sign in with Google to get your own copy"}
      </p>
    </div>
  );
}
