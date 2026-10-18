import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { CloneCta } from "@/components/share/clone-cta";
import { SharedRoadmap } from "@/components/share/shared-roadmap";
import { getShareReport, getSharedRoadmap } from "@/lib/db/share";
import { getSessionUser } from "@/lib/firebase/admin";
import { readinessHeadline } from "@/lib/readiness";
import type { ShareReport } from "@/lib/types";

const ogImage = (r: ShareReport) => `/api/og/sprint/${r.sprint_id}?v=${encodeURIComponent(r.updated_at)}`;

export async function generateMetadata({ params }: PageProps<"/share/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const report = await getShareReport(slug);
  if (!report) return { title: "Sprint not found — Sprintboard" };
  const headline = readinessHeadline(report.readiness) || `${report.stats.pct}% complete`;
  const title = `${report.title} — ${headline}`;
  const description = `${report.scout.line1} ${report.scout.line2}`;
  const images = [{ url: ogImage(report), width: 1200, height: 630, alt: `${report.title} readiness report` }];
  return {
    title,
    description,
    openGraph: { title, description, url: `/share/${report.slug}`, type: "website", siteName: "Sprintboard", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function SharePage({ params }: PageProps<"/share/[slug]">) {
  const { slug } = await params;
  const report = await getShareReport(slug);
  if (!report) notFound();
  const [problems, user] = await Promise.all([getSharedRoadmap(slug), getSessionUser()]);
  const { stats, scout, readiness } = report;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="bg-aurora pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Logo />
      </header>

      <section className="relative mx-auto grid max-w-4xl gap-6 px-6 pb-10">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{report.owner_name ? `${report.owner_name}'s readiness report` : "Readiness report"}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{report.title}</h1>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG PNG, already sized */}
        <img src={ogImage(report)} alt={`${report.title} readiness report`} width={1200} height={630} className="w-full rounded-2xl border shadow-2xl shadow-primary/10" />

        <div className="grid gap-4 sm:grid-cols-3">
          {readiness.map((r) => (
            <div key={r.company} className="rounded-2xl border bg-card/60 p-4">
              <p className="text-2xl font-semibold">{r.score}%</p>
              <p className="text-sm text-muted-foreground">
                Ready for {r.company}
                {r.confidence === "low" && <span className="ml-1 text-xs">(early)</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{r.done}/{r.total} problems</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card/60 p-5">
          <p className="text-xs font-medium tracking-widest text-primary">{scout.ai ? "AI SCOUT REPORT" : "SCOUT REPORT"}</p>
          <p className="mt-2 text-lg">{scout.line1}</p>
          <p className="text-lg text-muted-foreground">{scout.line2}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {stats.done}/{stats.total} solved · {stats.pct}% · {stats.streak}d streak · {stats.pro_done}/{stats.pro_total} Pro
          </p>
        </div>

        <CloneCta slug={report.slug} signedIn={Boolean(user)} />
      </section>

      <section className="relative mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-3 text-lg font-semibold">Roadmap</h2>
        <SharedRoadmap problems={problems} />
      </section>
    </main>
  );
}
