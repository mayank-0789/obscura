import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { DocTable } from "@/components/docs/doc-table";

// Global MDX provider map — every `.mdx` page in this project renders with
// these overrides. We style every markdown element to match the editorial
// docs aesthetic (Fraunces display for H1/H2, Geist Sans body, emerald
// accents) so authors only have to write plain markdown.
//
// Custom shortcuts:
//   <CodeBlock>, <Callout>  — existing docs primitives
//   <Kbd>                   — keyboard shortcut chip
//   <PackageInstall>        — per-PM tabs for install commands (new)
//
// Markdown overrides:
//   h1/h2/h3 → typed headings with emerald anchors
//   p, ul, ol, li, code, pre, a, table — themed equivalents
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    h1: (props) => (
      <h1
        className="mt-2 font-display text-[52px] font-light leading-[1.05] tracking-[-0.02em] text-zinc-50"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="group mt-14 scroll-mt-24 font-display text-[32px] font-light leading-[1.15] tracking-tight text-zinc-50"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="group mt-10 scroll-mt-24 text-[18px] font-medium tracking-tight text-zinc-100"
        {...props}
      />
    ),
    p: (props) => (
      <p
        className="mt-5 text-[17px] leading-[1.7] text-zinc-300"
        {...props}
      />
    ),
    ul: (props) => (
      <ul
        className="mt-5 space-y-3 pl-0 text-[17px] leading-[1.65] text-zinc-300 [&>li]:flex [&>li]:gap-3 [&>li]:before:mt-[11px] [&>li]:before:inline-block [&>li]:before:h-px [&>li]:before:w-4 [&>li]:before:shrink-0 [&>li]:before:bg-emerald-400/70 [&>li]:before:content-['']"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="mt-5 list-decimal space-y-3 pl-5 text-[17px] leading-[1.65] text-zinc-300 marker:text-zinc-600"
        {...props}
      />
    ),
    a: ({ href = "", ...props }) => {
      const external = /^https?:\/\//.test(href);
      if (external) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 transition hover:decoration-emerald-400"
            {...props}
          />
        );
      }
      return (
        <Link
          href={href}
          className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 transition hover:decoration-emerald-400"
          {...props}
        />
      );
    },
    code: (props) => (
      <code
        className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[13.5px] text-emerald-300"
        {...props}
      />
    ),
    // Note: `pre` rendering is intentionally minimal; authors should reach
    // for the <CodeBlock/> shortcut for anything user-copyable (filename,
    // lang chip, copy button). Plain triple-backtick fences fall through to
    // this for quick inline snippets.
    pre: (props) => (
      <pre
        className="mt-5 overflow-x-auto rounded-lg border border-zinc-800 bg-[#0b0b0d] p-5 font-mono text-[14px] leading-[1.65] text-zinc-300"
        {...props}
      />
    ),
    hr: () => (
      <hr className="mt-12 border-zinc-800" />
    ),
    blockquote: (props) => (
      <blockquote
        className="mt-6 border-l-2 border-emerald-400/60 pl-4 text-[17px] italic leading-[1.7] text-zinc-400"
        {...props}
      />
    ),
    table: (props) => (
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
        <table
          className="w-full border-collapse text-left text-[13.5px]"
          {...props}
        />
      </div>
    ),
    th: (props) => (
      <th
        className="border-b border-zinc-800 bg-[#0c0c0e] px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="border-b border-zinc-900 px-4 py-3 align-top text-zinc-300 last:border-0"
        {...props}
      />
    ),
    strong: (props) => (
      <strong className="font-semibold text-zinc-100" {...props} />
    ),
    // Shared docs components exposed as MDX shortcuts.
    CodeBlock,
    Callout,
    DocTable,
    Kbd,
  };
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-1.5 py-px font-mono text-[11px] font-medium text-zinc-300 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.04)]">
      {children}
    </kbd>
  );
}
