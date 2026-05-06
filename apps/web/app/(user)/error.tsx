"use client";

import { useEffect } from "react";
import Link from "next/link";

// Segment-level error boundary for /(user) pages — Next.js wires this automatically.
export default function UserSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[user-segment]", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">
        Something broke
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
        We hit a rendering error
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        This usually clears on retry. If it keeps happening, sign out and sign
        back in.
      </p>

      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
