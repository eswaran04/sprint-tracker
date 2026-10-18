"use client";

import { Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MAX_NUDGE } from "@/lib/digest/nudge-suggestions";
import type { GroupMember } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Popover for nudging a teammate with an optional short message. `children` is the trigger (bell or button).
 * Rate limits are enforced by the server; failures toast in the parent and leave the trigger enabled.
 */
export function NudgeComposer({ member, suggestions, onSend, children }: {
  member: GroupMember;
  suggestions: string[];
  onSend: (message: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const fieldId = useId();
  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_NUDGE;

  const send = (message: string | null) => {
    onSend(message);
    setOpen(false);
    setText("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3 p-3">
        <p className="text-sm font-medium">Nudge {member.display_name}</p>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Suggested messages">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
                  text === s && "border-primary/60 bg-primary/5 text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-1">
          <label htmlFor={fieldId} className="sr-only">Message for {member.display_name}</label>
          <Textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a message (optional)"
            className="min-h-14 resize-none text-sm"
            aria-invalid={tooLong || undefined}
            aria-describedby={`${fieldId}-count`}
          />
          <span id={`${fieldId}-count`} className={cn("justify-self-end text-[11px] tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
            {trimmed.length}/{MAX_NUDGE}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => send(null)}>Send without message</Button>
          <Button size="sm" disabled={!trimmed || tooLong} onClick={() => send(trimmed)}>
            <Send /> Send
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
