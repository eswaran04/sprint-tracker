import { Suspense } from "react";
import { StatsDashboard } from "@/components/stats/stats-dashboard";

export default async function StatsPage({ params }: PageProps<"/app/s/[id]/stats">) {
  const { id } = await params;
  return (
    <Suspense>
      <StatsDashboard id={id} />
    </Suspense>
  );
}
