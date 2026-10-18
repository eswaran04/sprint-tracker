import { useId } from "react";
import { cn } from "@/lib/utils";

/** Gemini-style four-point sparkle filled with the AI gradient. Decorative unless `title` is given. */
export function AiSparkle({ className, title }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-4 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={id} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--ai-1)" />
          <stop offset="0.5" stopColor="var(--ai-2)" />
          <stop offset="1" stopColor="var(--ai-3)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2c.5 5.2 4.8 9.5 10 10-5.2.5-9.5 4.8-10 10-.5-5.2-4.8-9.5-10-10 5.2-.5 9.5-4.8 10-10Z"
      />
    </svg>
  );
}

/** Small gradient pill used to flag AI-powered / newly released features. */
export function AiBadge({ label = "New", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "ai-badge inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[9px] leading-tight font-semibold tracking-wide uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}
