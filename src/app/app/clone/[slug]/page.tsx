import { CloneSprint } from "@/components/share/clone-sprint";

export default async function ClonePage({ params }: PageProps<"/app/clone/[slug]">) {
  const { slug } = await params;
  return <CloneSprint slug={slug} />;
}
