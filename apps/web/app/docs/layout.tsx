import type { Metadata } from "next";
import { DocsNav } from "@/components/docs/docs-nav";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Docs · Payrail",
  description:
    "Build AI agents that pay for APIs autonomously, and monetize APIs per-call. Quickstarts and reference for @payrail-app/sdk and @payrail-app/merchant-sdk.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <DocsNav />
      <div className="mx-auto flex max-w-[1400px] gap-x-10 px-6 lg:px-10">
        <DocsSidebar />
        <main className="min-w-0 flex-1 py-10 lg:py-16">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
