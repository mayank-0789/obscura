import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { SignInButton } from "@/components/auth/sign-in-button";

export const metadata: Metadata = {
  title: "Docs · Obscura",
  description:
    "Build AI agents that pay for APIs autonomously, and monetize APIs per-call. Quickstarts and reference for @obscura-app/sdk and @obscura-app/merchant-sdk.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] font-sans text-[#f5f5f5] antialiased"
      style={{ fontFeatureSettings: '"ss01", "cv11", "tnum"' } as CSSProperties}
    >
      <DocsTopBar />
      <div className="mx-auto flex max-w-[1280px] gap-x-10 px-6 lg:px-10">
        <DocsSidebar />
        <main className="min-w-0 flex-1 py-10 lg:py-14">{children}</main>
      </div>
      <DocsFooter />
    </div>
  );
}

function DocsTopBar() {
  return (
    <header className="border-b border-[#1f1f1f]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 lg:px-10">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-[15px] font-medium tracking-[-0.01em]">
            obscura
          </Link>
          <span className="font-mono text-[10px] text-[#5a5a5a]">───</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
            docs
          </span>
        </div>
        <nav className="flex items-center gap-7 font-mono text-[11px] uppercase tracking-[0.16em]">
          <Link href="/" className="text-[#888] hover:text-[#f5f5f5]">
            home
          </Link>
          <Link href="/demo" className="text-[#888] hover:text-[#f5f5f5]">
            demo
          </Link>
          <SignInButton />
        </nav>
      </div>
    </header>
  );
}

function DocsFooter() {
  return (
    <footer
      className="mx-auto max-w-[1280px] px-6 py-10 lg:px-10"
      style={{ borderTop: "1px solid #f5f5f5" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-y-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        <span>obscurapp.com</span>
        <span>built with umbra · solana frontier 2026</span>
        <span>mit</span>
      </div>
    </footer>
  );
}
