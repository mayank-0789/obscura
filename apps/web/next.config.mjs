import createMDX from "@next/mdx";

// MDX pipeline — deliberately minimal.
//
// Turbopack's loader contract requires "serializable options," which means
// remark/rehype plugin function references can't be passed through. We
// leave the pipeline empty and:
//   - use `useMDXComponents` (mdx-components.tsx) for all styling
//   - author GFM tables directly in MDX using the `<table>`/`<tr>` tags
//     our components provide (MDX allows inline JSX)
//   - skip automatic heading anchors — add manual `<a id="...">` spans
//     where deep linking matters
//
// Legacy path redirect: /docs/users/* was renamed to /docs/agents/*.

/** @type {import("next").NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async redirects() {
    return [
      {
        source: "/docs/users/:path*",
        destination: "/docs/agents/:path*",
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
