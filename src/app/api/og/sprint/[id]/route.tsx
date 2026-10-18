import { ImageResponse } from "next/og";
import { getShareReportForSprint } from "@/lib/db/share";
import type { CompanyReadiness, ShareReport } from "@/lib/types";

export const runtime = "nodejs";

const W = 1200;
const H = 630;
const BG = "#0a0a0f";
const FG = "#f4f4f6";
const MUTED = "#9a9aae";
const ACCENT = "#8b7cff";
const ACCENT_2 = "#3ad6c4";
const PRO = "#ff6b8b";

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);


function ReadinessPill({ r }: { r: CompanyReadiness }) {
  const color = r.score >= 75 ? ACCENT_2 : r.score >= 40 ? ACCENT : PRO;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "22px 26px", borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 64, color: FG, letterSpacing: -2, lineHeight: 1 }}>{`${r.score}%`}</div>
        {r.confidence === "low" && <div style={{ fontSize: 16, color: MUTED, padding: "2px 8px", borderRadius: 8, border: `1px solid ${MUTED}55` }}>early</div>}
      </div>
      <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 8 }}>{`Ready for ${truncate(r.company, 16)}`}</div>
      <div style={{ display: "flex", height: 8, marginTop: 16, borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", width: `${Math.max(2, r.score)}%`, height: 8, borderRadius: 8, background: color }} />
      </div>
    </div>
  );
}

function Card({ report }: { report: ShareReport }) {
  const { stats, scout, readiness } = report;
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: "52px 64px", background: BG, color: FG, position: "relative" }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: -260, right: -180, width: 760, height: 760, display: "flex", borderRadius: 760, background: `radial-gradient(circle, ${ACCENT}55 0%, ${ACCENT}00 65%)` }} />
      <div style={{ position: "absolute", bottom: -320, left: -220, width: 700, height: 700, display: "flex", borderRadius: 700, background: `radial-gradient(circle, ${ACCENT_2}2a 0%, ${ACCENT_2}00 65%)` }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17l5-5 4 4 7-8" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: FG }}>Sprintboard</div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED, marginLeft: 8 }}>· Readiness Report</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{report.owner_name ? truncate(report.owner_name, 28) : ""}</div>
      </div>

      <div style={{ display: "flex", fontSize: 40, marginTop: 30, color: FG, letterSpacing: -1 }}>{truncate(report.title, 48)}</div>

      {/* Readiness */}
      {readiness.length > 0 ? (
        <div style={{ display: "flex", gap: 20, marginTop: 26 }}>
          {readiness.slice(0, 3).map((r) => <ReadinessPill key={r.company} r={r} />)}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 26 }}>
          <div style={{ fontSize: 96, letterSpacing: -3, lineHeight: 1 }}>{`${stats.pct}%`}</div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>of the sprint complete</div>
        </div>
      )}

      {/* Scout */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
        <div style={{ display: "flex", fontSize: 18, color: ACCENT, letterSpacing: 3 }}>{scout.ai ? "AI SCOUT REPORT" : "SCOUT REPORT"}</div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 10, color: FG }}>{scout.line1}</div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 6, color: "#c9c9d6" }}>{scout.line2}</div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", marginTop: "auto", fontSize: 22, color: MUTED }}>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ display: "flex" }}>{`${stats.done}/${stats.total} solved`}</div>
          <div style={{ display: "flex" }}>{`${stats.streak}d streak`}</div>
          <div style={{ display: "flex", color: PRO }}>{`${stats.pro_done} Pro`}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * GET /api/og/sprint/[id] → 1200×630 PNG of the sprint's readiness report. Only sprints whose owner generated a
 * report render; anything else is a 404, so private sprints stay private. Links add `?v=updated_at` to bust caches.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/og/sprint/[id]">) {
  const { id } = await ctx.params;
  let report: ShareReport | null;
  try {
    report = await getShareReportForSprint(id);
  } catch (e) {
    console.error("[og:sprint]", e);
    return new Response("Failed to load report", { status: 500 });
  }
  if (!report) return new Response("Not found", { status: 404 });

  try {
    return new ImageResponse(<Card report={report} />, {
      width: W,
      height: H,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    console.error("[og:sprint]", e);
    return new Response("Failed to generate the image", { status: 500 });
  }
}
