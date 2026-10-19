"use client";

import { Menu, Search } from "lucide-react";
import { useState } from "react";
import { CommandPalette, openCommandPalette } from "@/components/command-palette";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ThemeButton } from "@/components/theme-picker";
import { AiTourModal } from "@/components/ai-tour/ai-tour-modal";
import { AccentSync } from "./accent-sync";
import { NudgeInbox } from "./nudge-inbox";
import { SessionUserProvider } from "./session-user";
import { SprintNav } from "./sprint-nav";
import { UserMenu, type SessionUser } from "./user-menu";

function Sidebar({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Logo href="/app" className="px-2 pt-1" />
      <button
        onClick={openCommandPalette}
        className="flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px]">⌘ K</kbd>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SprintNav onNavigate={onNavigate} />
      </div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1"><UserMenu user={user} /></div>
        <NudgeInbox />
        <ThemeButton syncToAccount />
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SessionUserProvider value={user}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar md:block">
          <Sidebar user={user} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/80 px-3 py-2 backdrop-blur md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <Logo href="/app" />
            <Button variant="ghost" size="icon" className="ml-auto" onClick={openCommandPalette} aria-label="Search">
              <Search />
            </Button>
          </header>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar user={user} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <CommandPalette />
        <AccentSync accent={user.accent} />
        <AiTourModal />
      </div>
    </SessionUserProvider>
  );
}
