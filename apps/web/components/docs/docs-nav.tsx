import Link from "next/link";
import { Logo } from "../marketing/logo";
import { SignInButton } from "../auth/sign-in-button";

export function DocsNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#0a0a0a]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <Logo />
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[22px] font-normal leading-none tracking-[-0.01em] text-zinc-50 transition group-hover:text-emerald-300">
              Payrail
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
              /docs
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6 text-[13px] text-zinc-400 md:gap-8">
          <Link href="/" className="transition hover:text-zinc-100">
            Home
          </Link>
          <Link href="/merchants" className="transition hover:text-zinc-100">
            For merchants
          </Link>
          <Link
            href="https://github.com/mayank-0789/payrail"
            className="hidden items-center gap-1.5 transition hover:text-zinc-100 md:inline-flex"
          >
            GitHub
            <span aria-hidden="true" className="text-[10px] text-zinc-600">
              ↗
            </span>
          </Link>
          <SignInButton />
        </nav>
      </div>
    </header>
  );
}
