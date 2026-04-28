import type { Metadata } from "next";
import { AgentSpendsShell } from "./agent-spends-shell";

export const metadata: Metadata = {
  title: "Spends · Obscura",
  description:
    "Full history of confirmed x402 payments this agent has made on Solana.",
};

export default async function AgentSpendsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentSpendsShell id={id} />;
}
