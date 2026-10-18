"use client";

import { Check, Compass, FolderKanban, Moon, Plus, Sparkles, Users, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import { useAccent } from "@/hooks/use-accent";
import { useMyGroups } from "@/hooks/use-groups";
import { useSprints } from "@/hooks/use-sprints";
import { ACCENTS, swatch } from "@/lib/accents";
import { setPaletteOpen, usePaletteContext, usePaletteOpen } from "@/lib/palette-store";
import { DifficultyDot } from "@/components/sprint/chips";

export const openCommandPalette = () => setPaletteOpen(true);

export function CommandPalette() {
  const open = usePaletteOpen();
  const ctx = usePaletteContext();
  const { data: sprints } = useSprints();
  const { data: groups } = useMyGroups();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [accent, setAccent] = useAccent({ syncToAccount: true });
  const [search, setSearch] = useState("");
  const aiText = search.trim();
  const showAi = Boolean(ctx?.aiFilter) && aiText.split(/\s+/).length >= 3;

  // Start fresh each time the palette opens (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setSearch("");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const run = (fn: () => void) => () => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setPaletteOpen} title="Command palette" description="Search problems, sprints and actions">
      <Command>
        <CommandInput value={search} onValueChange={setSearch} placeholder="Search problems, sprints, actions…" />
        <CommandList className="max-h-[60vh]">
          {!showAi && <CommandEmpty>No results.</CommandEmpty>}
          {showAi && ctx?.aiFilter && (
            <CommandGroup heading="AI" forceMount>
              {/* forceMount keeps cmdk's fuzzy match from hiding it; the value makes it rank first. */}
              <CommandItem forceMount value={`ai-filter ${aiText}`} onSelect={run(() => void ctx.aiFilter!(aiText))}>
                <Sparkles className="text-primary" />
                <span className="truncate">Filter with AI: “{aiText}”</span>
              </CommandItem>
            </CommandGroup>
          )}
          {ctx && ctx.actions.length > 0 && (
            <CommandGroup heading="Actions">
              {ctx.actions.map((a) => (
                <CommandItem key={a.id} onSelect={run(a.run)}>
                  <Zap /> {a.label}
                  {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {ctx && ctx.problems.length > 0 && (
            <CommandGroup heading="Problems">
              {ctx.problems.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.id}`} keywords={[...p.topics, ...p.companies]} onSelect={run(() => ctx.onSelectProblem(p))}>
                  {p.done_at ? <Check className="text-basic" /> : <DifficultyDot difficulty={p.difficulty} />}
                  <span className="truncate">{p.name}</span>
                  <CommandShortcut>Day {p.day_no}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Sprints">
            {sprints?.map((s) => (
              <CommandItem key={s.id} value={`sprint ${s.title} ${s.id}`} onSelect={run(() => router.push(`/app/s/${s.id}`))}>
                <FolderKanban /> {s.title}
              </CommandItem>
            ))}
            <CommandItem onSelect={run(() => router.push("/app/import"))}>
              <Plus /> New sprint from xlsx
            </CommandItem>
            <CommandItem onSelect={run(() => router.push("/app/explore"))}>
              <Compass /> Explore public sheets
            </CommandItem>
            {groups?.map((g) => (
              <CommandItem key={g.id} value={`group ${g.name} ${g.id}`} onSelect={run(() => router.push(`/app/groups/${g.id}`))}>
                <Users /> Group: {g.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Preferences">
            <CommandItem onSelect={run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              <Moon /> Toggle light / dark
            </CommandItem>
            {ACCENTS.map((a) => (
              <CommandItem key={a.id} value={`theme colour ${a.label}`} onSelect={run(() => setAccent(a.id))}>
                <span className="size-3.5 rounded-full" style={{ background: swatch(a) }} />
                Theme colour: {a.label}
                {accent === a.id && <Check className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
