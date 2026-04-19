import Link from "next/link";
import { Logo } from "./logo";
import { SignInButton } from "../auth/sign-in-button";

export function Nav({
  variant = "user",
}: {
  variant?: "user" | "merchant";
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#0a0a0a]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-semibold tracking-tight">
            Payrail
          </span>
          {variant === "merchant" && (
            <span className="ml-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Merchants
            </span>
          )}
        </Link>

        <nav className="flex items-center gap-6 text-sm text-zinc-400 md:gap-7">
          <Link href="/docs" className="transition hover:text-zinc-100">
            Docs
          </Link>
          {variant === "user" ? (
            <Link
              href="/merchants"
              className="transition hover:text-zinc-100"
            >
              For merchants
            </Link>
          ) : (
            <Link href="/" className="transition hover:text-zinc-100">
              For agent devs
            </Link>
          )}
          <Link
            href="https://github.com"
            className="hidden transition hover:text-zinc-100 md:inline"
          >
            GitHub
          </Link>
          <SignInButton />
        </nav>
      </div>
    </header>
  );
}
