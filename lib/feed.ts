/**
 * RSS body rendering: an article's MDX source -> standalone HTML.
 *
 * The feed is a real public feed, but its load-bearing consumer is the Discord
 * bot (Fault Foundation DC Bot, src/wordpress/), which replaced its WordPress
 * `/wp-json/wp/v2/posts` poller with this file after the site moved off
 * WordPress. Two properties that module depends on:
 *
 *   1. `<content:encoded>` carries the FULL article HTML, not the excerpt. The
 *      bot renders whole articles into Discord, not teasers.
 *   2. Section headings stay `<h2>`. The bot splits an article into one Discord
 *      message per H2, so changing the heading level in news/**\/index.mdx
 *      changes how announcements are chunked.
 *
 * Runs at build time only (app/feed.xml/route.ts is force-static).
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import { SITE_URL } from "@/lib/site";

/**
 * remark-rehype drops raw HTML nodes unless `allowDangerousHtml` is set, and we
 * deliberately leave it unset. That is what strips `<Gallery images={...} />`
 * from the feed: it is a React component, meaningless outside the site bundle,
 * and there is no sane RSS equivalent. Article prose is otherwise pure
 * markdown (verified across news/**\/index.mdx), so nothing else is lost.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

/** `/wp-content/x.png` -> `https://fault.foundation/wp-content/x.png`. */
function absolutize(html: string): string {
  return html.replace(
    /\b(src|href)="\/(?!\/)/g,
    (_match, attr: string) => `${attr}="${SITE_URL}/`,
  );
}

/**
 * Render an article body (frontmatter already stripped by gray-matter) to the
 * HTML that goes inside `<content:encoded>`.
 */
export function renderBodyHtml(mdxSource: string): string {
  return absolutize(String(processor.processSync(mdxSource)));
}

/** XML text escaping, for element content and attribute values alike. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap HTML in CDATA. `]]>` inside the payload would terminate the section
 * early, so it is split across two adjacent CDATA blocks — the parsed result
 * is byte-identical.
 */
export function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * RFC 822 date, as RSS 2.0 requires.
 *
 * lib/posts.ts warns against routing article dates through `Date` — that rule
 * is about DISPLAY strings, where `new Date(iso)` rendered in UTC shifts
 * "2025-11-29T21:01:32-04:00" to November 30. Here we want the absolute
 * instant, and the offset in the frontmatter is exactly what makes the
 * conversion correct. `toUTCString()` emits "Sun, 30 Nov 2025 01:01:32 GMT",
 * which is a valid RFC 822 date for that same moment.
 */
export function rfc822(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Unparseable date: ${iso}`);
  return date.toUTCString();
}
