"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { similarSheets } from "@/lib/api";
import { SheetCard } from "./sheet-card";

/** "Sheets like this one": nearest public sheets by embedding. Renders nothing until there are results. */
export function SimilarSheets({ sheetId }: { sheetId: string }) {
  const { data } = useQuery({
    queryKey: ["similar-sheets", sheetId],
    queryFn: () => similarSheets(sheetId, 3),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!data?.length) return null;
  return (
    <section aria-labelledby="similar-sheets" className="grid gap-3">
      <h2 id="similar-sheets" className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" /> Sheets like this one
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => <SheetCard key={s.id} sheet={s} />)}
      </div>
    </section>
  );
}
