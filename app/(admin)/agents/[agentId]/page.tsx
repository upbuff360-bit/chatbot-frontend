import { redirect } from "next/navigation";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  redirect(`/agents/${agentId}/knowledge/pdfs`);
}
