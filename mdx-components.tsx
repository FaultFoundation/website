import type { MDXComponents } from "mdx/types";

import { Gallery } from "@/components/article/Gallery";
import { YouTube } from "@/components/article/YouTube";
import { Callout, Figure, PullQuote } from "@/components/article/blocks";

/**
 * Required by @next/mdx: every MDX file imported anywhere in the app renders
 * through this mapping.
 *
 * Element overrides are deliberately minimal — .ff-prose--article on the body
 * wrapper styles headings, lists, links and quotes by tag, so most elements
 * need no per-element class. Only tables need structural help (a scroll
 * container), which cannot be expressed in CSS alone.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,

    // Wide tables must scroll inside their own container rather than forcing
    // the page to scroll horizontally. .ff-table-wrap already exists for the
    // policy pages.
    table: ({ children, ...props }) => (
      <div className="ff-table-wrap">
        <table {...props}>{children}</table>
      </div>
    ),

    // Bare images in Markdown (`![alt](src)`) become figures so they pick up
    // the rounded-corner treatment and can break out of the reading measure.
    img: ({ src, alt, ...props }) => (
      <figure className="ff-article-figure">
        <img
          src={typeof src === "string" ? src : undefined}
          alt={alt ?? ""}
          decoding="async"
          loading="lazy"
          {...props}
        />
        {alt ? <figcaption>{alt}</figcaption> : null}
      </figure>
    ),

    // Components available to authors without an import. See news/README.md.
    Figure,
    PullQuote,
    Callout,
    Gallery,
    YouTube,
  };
}
