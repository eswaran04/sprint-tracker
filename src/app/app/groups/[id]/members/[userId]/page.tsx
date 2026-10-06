import { MemberProfile } from "@/components/groups/member-profile";

export default async function MemberPage({ params }: PageProps<"/app/groups/[id]/members/[userId]">) {
  const { id, userId } = await params;
  return <MemberProfile groupId={id} userId={userId} />;
}
