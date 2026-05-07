import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { DocTable } from "@/components/docs/doc-table";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    h1: (props) => (
      <h1
        className="mt-2 text-[44px] font-medium leading-[1.05] tracking-[-0.025em] text-[#f5f5f5]"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="group mt-14 scroll-mt-24 text-[28px] font-medium leading-[1.2] tracking-[-0.02em] text-[#f5f5f5]"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="group mt-10 scroll-mt-24 text-[18px] font-medium tracking-[-0.01em] text-[#f5f5f5]"
        {...props}
      />
    ),
    p: (props) => (
      <p
        className="mt-5 text-[16px] leading-[1.65] text-[#aaa]"
        {...props}
      />
    ),
    ul: (props) => (
      // Absolute-positioned bullet keeps <li> as a block element; flex made
      // every inline child its own flex item and staircased the rendering.
      <ul
        className="mt-5 space-y-3 pl-7 text-[16px] leading-[1.6] text-[#aaa] [&>li]:relative [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[12px] [&>li]:before:inline-block [&>li]:before:h-px [&>li]:before:w-4 [&>li]:before:bg-[#e63946] [&>li]:before:content-['']"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="mt-5 list-decimal space-y-3 pl-5 text-[16px] leading-[1.6] text-[#aaa] marker:text-[#5a5a5a]"
        {...props}
      />
    ),
    a: ({ href = "", ...props }) => {
      const external = /^https?:\/\//.test(href);
      const className =
        "text-[#e63946] underline decoration-[#e63946]/40 underline-offset-4 transition hover:decoration-[#e63946]";
      if (external) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            {...props}
          />
        );
      }
      return <Link href={href} className={className} {...props} />;
    },
    code: (props) => (
      <code
        className="border border-[#1f1f1f] bg-[#0e0e0e] px-1.5 py-0.5 font-mono text-[13px] text-[#e63946]"
        {...props}
      />
    ),
    // Plain triple-backtick fences land here; reach for <CodeBlock/> when a
    // copy button / filename chip is needed.
    pre: (props) => (
      <pre
        className="mt-5 overflow-x-auto border border-[#1f1f1f] bg-[#0e0e0e] p-5 font-mono text-[13px] leading-[1.65] text-[#f5f5f5]"
        {...props}
      />
    ),
    hr: () => <hr className="mt-12 border-[#1f1f1f]" />,
    blockquote: (props) => (
      <blockquote
        className="mt-6 border-l border-[#e63946] pl-4 text-[16px] leading-[1.65] text-[#888]"
        {...props}
      />
    ),
    table: (props) => (
      <div className="mt-6 overflow-x-auto border border-[#1f1f1f]">
        <table
          className="w-full border-collapse text-left text-[13.5px]"
          {...props}
        />
      </div>
    ),
    th: (props) => (
      <th
        className="border-b border-[#1f1f1f] bg-[#0e0e0e] px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="border-b border-[#1f1f1f] px-4 py-3 align-top text-[#aaa] last:border-0"
        {...props}
      />
    ),
    strong: (props) => (
      <strong className="font-semibold text-[#f5f5f5]" {...props} />
    ),
    CodeBlock,
    Callout,
    DocTable,
    Kbd,
  };
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center border border-[#1f1f1f] bg-[#0a0a0a] px-1.5 py-px font-mono text-[10px] font-medium text-[#888]">
      {children}
    </kbd>
  );
}
