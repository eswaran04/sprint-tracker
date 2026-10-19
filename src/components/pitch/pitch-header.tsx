"use client";

import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeButton } from "@/components/theme-picker";

const NAV_ITEMS = [
  { label: "Why", href: "#pain-points" },
  { label: "The Solution", href: "#solution" },
  { label: "Interactive Demo", href: "#interactive-demo" },
  { label: "Free vs Pro", href: "#feature-matrix" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function PitchHeader() {
  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 76;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      window.history.pushState(null, "", href);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo className="transition-transform hover:scale-[1.02]" />
        </div>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => scrollTo(e, item.href)}
              className="relative py-1 transition-all duration-200 hover:text-foreground hover:-translate-y-0.5"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeButton side="bottom" />
          <a
            href="/app"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:scale-[1.02]"
          >
            <span>Launch App</span>
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}
