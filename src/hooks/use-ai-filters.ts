"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { aiFilters } from "@/lib/api";
import { describeFilters, FACET_KEYS, MAX_FACET_VALUES, MAX_QUERY_LENGTH, type FacetNames } from "@/lib/ai/nl-filters";
import { DEFAULT_FILTERS, type Facet, type Filters } from "@/lib/filters";

type FacetCounts = Record<(typeof FACET_KEYS)[number], Facet[]>;

/**
 * Natural-language filtering for one sheet. `run(text)` asks the server, replaces the current filters with the
 * interpretation (keeping the user's sort unless the query asked for one), and offers Undo in a toast.
 */
export function useAiFilters(facets: FacetCounts, filters: Filters, setFilters: (f: Partial<Filters>) => void) {
  const names: FacetNames = useMemo(
    () => Object.fromEntries(FACET_KEYS.map((k) => [k, facets[k].slice(0, MAX_FACET_VALUES).map((f) => f.value)])) as FacetNames,
    [facets],
  );
  const mutation = useMutation({
    // `previous` travels with the call so Undo restores what was on screen when the user asked.
    mutationFn: ({ text }: { text: string; previous: Filters }) => aiFilters(text.trim().slice(0, MAX_QUERY_LENGTH), names),
    onSuccess: (result, { previous }) => {
      setFilters({ ...DEFAULT_FILTERS, sort: previous.sort, dir: previous.dir, ...result });
      toast.success(`Interpreted as: ${describeFilters(result)}`, {
        action: { label: "Undo", onClick: () => setFilters(previous) },
      });
    },
    onError: (e) => toast.error("Couldn't filter with AI", { description: e.message }),
  });

  const { mutateAsync } = mutation;
  const run = useCallback(async (text: string) => {
    if (!text.trim()) return;
    await mutateAsync({ text, previous: filters }).catch(() => {});
  }, [mutateAsync, filters]);

  return { run, isPending: mutation.isPending };
}
