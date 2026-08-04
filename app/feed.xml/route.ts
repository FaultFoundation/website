/**
 * RSS 2.0 feed at /feed.xml.
 *
 * Emitted as a static file by `output: "export"` (hence force-static), the same
 * way app/sitemap.ts produces /sitemap.xml. It is the replacement for the
 * WordPress `/wp-json/wp/v2/posts` endpoint that vanished when the site moved
 * off WordPress — see lib/feed.ts for the contract the Discord bot relies on.
 */

import { getAuthor } from "@/lib/authors";
import { getAllPosts, getPostBody } from "@/lib/content";
import { cdata, escapeXml, renderBodyHtml, rfc822 } from "@/lib/feed";
import { tagLabels } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

const TITLE = "Fault Foundation";
const DESCRIPTION = "News and updates from the Fault Foundation.";

export function GET(): Response {
  const posts = getAllPosts();

  const items = posts.map((post) => {
    const url = `${SITE_URL}${post.href}`;
    const author = getAuthor(post.authorKey);
    const hero = post.image?.src
      ? `${SITE_URL}${post.image.src}`
      : undefined;

    return [
      "    <item>",
      `      <title>${cdata(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      // isPermaLink="true" means the bot can treat this as both the identity
      // and the canonical URL. It is the article path, which never changes:
      // lib/content.ts hard-fails the build if a folder and its date disagree.
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${rfc822(post.dateISO)}</pubDate>`,
      // pubDate must be RFC 822, which forces a UTC rendering that can land on
      // the NEXT calendar day: 2025-11-29T21:01:32-04:00 is "30 Nov ... GMT",
      // while the site's byline says November 29. dc:date keeps the verbatim
      // frontmatter offset so consumers can show the same day the site does —
      // the Discord bot reads this one for its byline and falls back to pubDate.
      `      <dc:date>${escapeXml(post.dateISO)}</dc:date>`,
      `      <dc:creator>${cdata(author.name)}</dc:creator>`,
      ...post.tags.map(
        (tag) => `      <category>${cdata(tagLabels[tag])}</category>`,
      ),
      `      <description>${cdata(post.excerpt)}</description>`,
      `      <content:encoded>${cdata(renderBodyHtml(getPostBody(post.contentId)))}</content:encoded>`,
      // enclosure is the RSS-native hero image; the bot reads it as the
      // featured image it attaches to the Discord thread.
      ...(hero
        ? [
            `      <enclosure url="${escapeXml(hero)}" type="image/${hero.endsWith(".png") ? "png" : "jpeg"}" length="0" />`,
            `      <media:content url="${escapeXml(hero)}" medium="image" />`,
          ]
        : []),
      "    </item>",
    ].join("\n");
  });

  const lastBuild = posts.length > 0 ? rfc822(posts[0].dateISO) : undefined;

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '     xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '     xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '     xmlns:atom="http://www.w3.org/2005/Atom"',
    '     xmlns:media="http://search.yahoo.com/mrss/">',
    "  <channel>",
    `    <title>${cdata(TITLE)}</title>`,
    `    <link>${escapeXml(SITE_URL)}/</link>`,
    `    <description>${cdata(DESCRIPTION)}</description>`,
    "    <language>en-US</language>",
    `    <atom:link href="${escapeXml(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml" />`,
    ...(lastBuild ? [`    <lastBuildDate>${lastBuild}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
