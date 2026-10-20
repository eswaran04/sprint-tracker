"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cloneSharedSprint } from "@/lib/api";

/** Lands here after "Clone this Sprint" (and sign-in): copies once, then opens the new sprint. */
export function CloneSprint({ slug }: { slug: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const started = useRef(false);

  const clone = useMutation({
    mutationFn: () => cloneSharedSprint(slug),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint cloned", { description: "It starts today. Make it yours in Settings." });
      router.replace(`/app/s/${id}`);
    },
  });

  // Strict Mode mounts twice; the SQL function is idempotent anyway, this just avoids a second request.
  const { mutate } = clone;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);

  if (clone.isError) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="font-medium">Couldn&apos;t clone this sprint</p>
        <p className="mt-1 text-sm text-muted-foreground">{clone.error.message}</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/app">Back to your sprints</Link></Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 p-16 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> Cloning sprint…
    </div>
  );
}
