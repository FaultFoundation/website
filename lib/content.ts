/**
 * Filesystem loader for news/<YYYY>/<MM>/<slug>/index.mdx.
 *
 * Runs at build time only (generateStaticParams / generateMetadata / server
 * components). Keep `node:fs` confined to this module — lib/posts.ts is
 * imported by components that must stay bundle-safe.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

import {
  KNOWN_TAGS,
  dateSegments,
  formatDateDisplay,
  type Post,
  type TagSlug,
} from "@/lib/posts";
import { parseFrontmatter, type Frontmatter } from "@/lib/content/frontmatter";

const NEWS_DIR = join(process.cwd(), "news");

export type Heading = { depth: 2 | 3; text: string; id: string };

export type LoadedPost = Post & {
  frontmatter: Frontmatter;
  headings: Heading[];
  /** "2026/01/community-verification" — the folder path, minus news/. */
  contentId: string;
};

/** Every news/<YYYY>/<MM>/<slug> directory that contains an index.mdx. */
function discoverContentIds(): string[] {
  if (!existsSync(NEWS_DIR)) return [];
  const ids: string[] = [];
  const dirs = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();

  for (const year of dirs(NEWS_DIR)) {
    if (!/^\d{4}$/.test(year)) continue;
    for (const month of dirs(join(NEWS_DIR, year))) {
      if (!/^\d{2}$/.test(month)) continue;
      for (const slug of dirs(join(NEWS_DIR, year, month))) {
        if (existsSync(join(NEWS_DIR, year, month, slug, "index.mdx"))) {
          ids.push(`${year}/${month}/${slug}`);
        }
      }
    }
  }
  return ids;
}

/**
 * ATX headings (## / ###) outside fenced code blocks, slugged with the same
 * slugger rehype-slug uses so the TOC anchors provably match the rendered ids.
 */
function extractHeadings(body: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    // Strip inline markdown so the TOC label matches the rendered text.
    const text = match[2]
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    headings.push({
      depth: match[1].length as 2 | 3,
      text,
      id: slugger.slug(text),
    });
  }
  return headings;
}

function readingMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function loadOne(contentId: string): LoadedPost {
  const [year, month, slug] = contentId.split("/");
  const file = join(NEWS_DIR, year, month, slug, "index.mdx");
  const parsed = matter(readFileSync(file, "utf8"));
  const relFile = `news/${contentId}/index.mdx`;
  const frontmatter = parseFrontmatter(parsed.data, relFile);

  // The folder path is the URL, and it must agree with the date the article
  // claims — otherwise /2026/01/... would render a "December 2025" byline.
  const expected = dateSegments(frontmatter.date);
  if (expected.year !== year || expected.month !== month) {
    throw new Error(
      `${relFile}: date ${frontmatter.date} implies news/${expected.year}/${expected.month}/, ` +
        `but the file is in news/${year}/${month}/. Move the folder or fix the date.`,
    );
  }

  return {
    contentId,
    href: `/${contentId}/`,
    year,
    month,
    slug,
    title: frontmatter.title,
    dateISO: frontmatter.date,
    dateDisplay: formatDateDisplay(frontmatter.date),
    updatedISO: frontmatter.updated,
    image: frontmatter.hero,
    excerpt: frontmatter.excerpt,
    tags: frontmatter.tags,
    authorKey: frontmatter.author,
    readingMinutes: readingMinutes(parsed.content),
    frontmatter,
    headings: extractHeadings(parsed.content),
  };
}

/**
 * Should this article appear in the build?
 *
 * Drafts and articles awaiting review are always visible in `next dev`, so you
 * can see what you are writing. For a shareable preview of unpublished work,
 * set INCLUDE_DRAFTS=1 — e.g. as a branch-scoped variable on Cloudflare
 * preview deployments.
 */
function isVisible(post: LoadedPost): boolean {
  if (process.env.INCLUDE_DRAFTS === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;
  const { frontmatter } = post;
  if (frontmatter.draft) return false;
  // A non-empty needsReview means a human still has to look at this — used by
  // the social importers, which can only guess at titles and alt text.
  if (frontmatter.needsReview.length > 0) return false;
  return true;
}

let cache: LoadedPost[] | null = null;

/** Every visible post, newest first. */
export function getAllPosts(): LoadedPost[] {
  if (cache) return cache;
  cache = discoverContentIds()
    .map(loadOne)
    .filter(isVisible)
    // contentId sorts chronologically (YYYY/MM/...) but not within a month,
    // so sort on the full timestamp. String compare is safe: all dates are
    // validated ISO 8601, and comparing offsets lexically only misorders
    // posts published within hours of each other across timezones.
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
  return cache;
}

export function getPost(
  year: string,
  month: string,
  slug: string,
): LoadedPost | undefined {
  return getAllPosts().find(
    (post) => post.year === year && post.month === month && post.slug === slug,
  );
}

export function getPostsByTag(tag: TagSlug): LoadedPost[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}

/**
 * All tags, including ones with no visible posts — a tag page must not start
 * 404ing because its only article is currently a draft.
 */
export function getAllTags(): readonly TagSlug[] {
  return KNOWN_TAGS;
}

/** Most tag overlap first, then most recent. */
export function getRelated(post: LoadedPost, limit = 3): LoadedPost[] {
  return getAllPosts()
    .filter((candidate) => candidate.contentId !== post.contentId)
    .map((candidate) => ({
      candidate,
      shared: candidate.tags.filter((tag) => post.tags.includes(tag)).length,
    }))
    .sort((a, b) =>
      b.shared !== a.shared
        ? b.shared - a.shared
        : a.candidate.dateISO < b.candidate.dateISO
          ? 1
          : -1,
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
