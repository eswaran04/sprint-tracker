import { PitchHeader } from "@/components/pitch/pitch-header";
import { PitchHero } from "@/components/pitch/pitch-hero";
import { PainPointsSection } from "@/components/pitch/pain-points";
import { SolutionShowcaseSection } from "@/components/pitch/solution-showcase";
import { InteractiveDemoSection } from "@/components/pitch/interactive-demo";
import { FeatureGatingMatrixSection } from "@/components/pitch/feature-gating-matrix";
import { PricingGPaySection } from "@/components/pitch/pricing-gpay";
import { FaqSection } from "@/components/pitch/faq";
import { PitchFooter } from "@/components/pitch/pitch-footer";

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Aurora & Grid Backgrounds */}
      <div className="bg-aurora pointer-events-none fixed inset-0 z-0 opacity-70" />
      <div className="bg-grid pointer-events-none fixed inset-0 z-0 opacity-60" />

      {/* Main Pitch Flow */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <PitchHeader />
        
        <main className="flex-1">
          <PitchHero error={error} />
          <PainPointsSection />
          <SolutionShowcaseSection />
          <InteractiveDemoSection />
          <FeatureGatingMatrixSection />
          <PricingGPaySection />
          <FaqSection />
        </main>

        <PitchFooter />
      </div>
    </div>
  );
}
