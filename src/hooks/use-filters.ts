"use client";

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";
import { SORTS, STATUSES, type Filters } from "@/lib/filters";

const list = parseAsArrayOf(parseAsString, ",").withDefault([]);

export const filterParsers = {
  q: parseAsString.withDefault(""),
  subjects: list,
  difficulties: list,
  companies: list,
  topics: list,
  status: parseAsStringLiteral(STATUSES).withDefault("all"),
  sort: parseAsStringLiteral(SORTS).withDefault("day"),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
};

export function useFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers, { history: "replace" });
  return [filters as Filters, setFilters] as const;
}

/** `?ai=search|reschedule` — deep link from navigation that opens an AI feature once the sprint loads. */
export const AI_INTENTS = ["search", "reschedule"] as const;
export type AiIntent = (typeof AI_INTENTS)[number];
export const useAiIntent = () => useQueryState("ai", parseAsStringLiteral(AI_INTENTS).withOptions({ history: "replace" }));

export const useView = () =>
  useQueryStates({ view: parseAsStringLiteral(["timeline", "table"] as const).withDefault("timeline") }, { history: "replace" });
