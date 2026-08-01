import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const nextConfig: NextConfig = {
  // Pure static export for Cloudflare Pages.
  output: "export",
  // WordPress permalinks all end in "/" — emit out/about/index.html etc.
  trailingSlash: true,
  // Required for `output: export`; markup uses plain <img> ported from WP anyway.
  images: { unoptimized: true },
  // NOTE: "mdx" is deliberately NOT in pageExtensions. Article content lives
  // in news/, outside app/, and is pulled in by app/[year]/[month]/[slug]/.
  // Adding it here would make Next try to treat content files as routes.

  webpack(config, { isServer }) {
    // Point MDX modules at Next's vendored React JSX runtimes.
    //
    // Next rewrites `react/jsx-runtime` to a layer-specific vendored copy for
    // the files it owns (.ts/.tsx), but that rewrite does not reach modules
    // produced by @mdx-js/loader. They resolved to node_modules/react/... —
    // React's CLIENT build — while `react` itself resolved to the react-server
    // build. The runtime then read ReactSharedInternals off the wrong module
    // and every article threw "Cannot read properties of undefined (reading
    // 'recentlyCreatedOwnerStacks')" in `next dev`.
    //
    // `module.rules[].resolve` scopes the alias to how MDX files resolve THEIR
    // imports, so nothing else in the app is affected.
    if (isServer) {
      const vendored = "next/dist/server/route-modules/app-page/vendored";
      const rule = (layer: string, dir: string) => ({
        test: /\.mdx$/,
        issuerLayer: layer,
        resolve: {
          alias: {
            "react/jsx-runtime": `${vendored}/${dir}/react-jsx-runtime`,
            "react/jsx-dev-runtime": `${vendored}/${dir}/react-jsx-dev-runtime`,
          },
        },
      });
      // Layer names are Next's WEBPACK_LAYERS constants, which are not
      // exposed on the webpack config context — hence the string literals.
      config.module.rules.push(rule("rsc", "rsc"), rule("ssr", "ssr"));
    }
    return config;
  },
};

const withMDX = createMDX({
  options: {
    // remark-frontmatter is REQUIRED: without it the leading `---` block is
    // parsed as a thematic break + heading instead of being ignored. The
    // frontmatter itself is read separately by lib/content.ts via gray-matter.
    //
    // Deliberately absent: remark-smartypants. It rewrites " -> “” and
    // ' -> ’, which would silently change characters in ported WordPress
    // copy — the exact failure scripts/extract-text.mjs exists to catch.
    // The legacy text already contains literal curly quotes.
    remarkPlugins: [remarkFrontmatter, remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: {
            className: "ff-article__anchor",
            "aria-hidden": "true",
            tabIndex: -1,
          },
        },
      ],
    ],
    // If this project ever opts into Turbopack, these imported plugin
    // functions must become string tuples (e.g. [["remark-gfm", {}]]) —
    // Turbopack serializes the config to Rust and cannot carry functions.
  },
});

export default withMDX(nextConfig);
