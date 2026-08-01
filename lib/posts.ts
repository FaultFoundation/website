/**
 * Shared news types and constants.
 *
 * This module must stay free of `node:fs` — `ImageSource` is type-imported by
 * app/page.tsx, app/about/page.tsx, components/SplitFeature.tsx and
 * lib/heroSlides.ts, and `tagLabels` is value-imported by
 * components/NewsCard.tsx. The filesystem loader that reads news/**\/index.mdx
 * lives in lib/content.ts instead.
 */

export type ImageSource = {
  src: string;
  width: number;
  height: number;
  srcSet?: string;
  sizes?: string;
  /** "" is meaningful: decorative, hidden from assistive tech. */
  alt?: string;
  caption?: string;
};

/**
 * Every tag that has an archive page. Adding a tag is a two-line change here
 * plus nothing else — app/tag/[tag]/ generates a page for each entry. A tag in
 * frontmatter that is not listed here fails the build rather than silently
 * producing a chip that links to a 404.
 */
export const KNOWN_TAGS = ["discussion", "future", "news", "update"] as const;

export type TagSlug = (typeof KNOWN_TAGS)[number];

/**
 * Rendered tag labels exactly as they appear on the live site. "future" is
 * lowercase on purpose — it matches the original WordPress tag casing and the
 * live <title> string "future Archives".
 */
export const tagLabels: Record<TagSlug, string> = {
  discussion: "Discussion",
  future: "future",
  news: "News",
  update: "Update",
};

export type Post = {
  /** "/2026/01/community-verification/" */
  href: string;
  /** URL segments, taken from the folder path (which mirrors the date). */
  year: string;
  month: string;
  slug: string;
  title: string;
  /** Verbatim frontmatter date, offset included. */
  dateISO: string;
  /** "January 15, 2026" — derived from the literal date prefix, never a Date. */
  dateDisplay: string;
  /** Optional last-modified stamp. */
  updatedISO?: string;
  image: ImageSource;
  excerpt: string;
  tags: TagSlug[];
  authorKey: string;
  readingMinutes: number;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Format "2025-11-29T21:01:32-04:00" as "November 29, 2025".
 *
 * Deliberately string-based. `new Date(iso)` formatted in UTC renders that
 * example as November 30 — the live site says November 29, and the offset in
 * the frontmatter is what makes it so. Never route this through Date.
 */
export function formatDateDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) throw new Error(`Unparseable date: ${iso}`);
  const [, year, month, day] = match;
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** The "/YYYY/MM/" URL segments, likewise from the literal prefix. */
export function dateSegments(iso: string): { year: string; month: string } {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) throw new Error(`Unparseable date: ${iso}`);
  return { year: match[1], month: match[2] };
}
