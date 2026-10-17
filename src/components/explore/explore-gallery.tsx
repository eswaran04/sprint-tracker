"use client";

import { useQuery } from "@tanstack/react-query";
import { Compass, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublicSheets } from "@/lib/api";
import { MAANG } from "@/lib/companies";
import { filterSheets, type SheetSort } from "@/lib/sheets";
import { cn } from "@/lib/utils";
import { RecommendedSheets } from "./recommended-sheets";
import { SheetCard } from "./sheet-card";

const SORT_LABELS: Record<SheetSort, string> = { newest: "Newest", popular: "Most copied", shortest: "Shortest", largest: "Most problems" };

export function ExploreGallery() {
  const { data, isLoading, error } = useQuery({ queryKey: ["public-sheets"], queryFn: listPublicSheets });
  const [q, setQ] = useState("");
  const [company, setCompany] = useState("");
  const [sort, setSort] = useState<SheetSort>("newest");
  const sheets = useMemo(() => filterSheets(data ?? [], { q, company, sort }), [data, q, company, sort]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Compass className="size-6 text-primary" /> Explore sheets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Prep sheets shared by the community. Copy one to start your own sprint.</p>
      </div>

      <RecommendedSheets />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sheets, topics, companies…" className="h-8 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MAANG.map((c) => (
            <button
              key={c}
              onClick={() => setCompany(company === c ? "" : c)}
              aria-pressed={company === c}
              className={cn(
                "h-7 rounded-full border px-3 text-xs transition-colors",
                company === c ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
          {company && !(MAANG as readonly string[]).includes(company) && (
            <Button variant="ghost" size="sm" onClick={() => setCompany("")}><X /> {company}</Button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SheetSort)}>
          <SelectTrigger size="sm" className="ml-auto w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load sheets: {error.message}</p>}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed px-6 py-16 text-center">
          <p className="font-medium">No public sheets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first — open one of your sprints → Settings → turn on “Public sheet”.</p>
          <Button asChild variant="outline" className="mt-4"><Link href="/app">Go to your sprints</Link></Button>
        </div>
      )}
      {data && data.length > 0 && sheets.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No sheets match. Try a different search.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.map((s) => <SheetCard key={s.id} sheet={s} />)}
      </div>
    </div>
  );
}
