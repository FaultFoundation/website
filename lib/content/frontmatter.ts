/**
 * Hand-rolled frontmatter validator. Every failure names the offending file
 * and field, and throws — a malformed article must break the build, not
 * render half-empty.
 *
 * Hand-rolled rather than zod-based to keep the dependency surface small and
 * to match the rest of this repo (which hand-rolls an HTML parser in
 * scripts/port_html.py).
 */

import { KNOWN_TAGS, type ImageSource, type TagSlug } from "@/lib/posts";
import { authors } from "@/lib/authors";

export type ContentSource = "original" | "bluesky-import" | "facebook-import";

export type Frontmatter = {
  title: string;
  date: string;
  updated?: string;
  author: string;
  tags: TagSlug[];
  excerpt: string;
  hero: ImageSource;
  toc: boolean;
  draft: boolean;
  source: ContentSource;
  sourceRef?: string;
  /** Non-empty means "a human still has to look at this" — blocks publish. */
  needsReview: string[];
};

const CONTENT_SOURCES: ContentSource[] = [
  "original",
  "bluesky-import",
  "facebook-import",
];

/** ISO 8601 with an explicit offset — "2026-01-15T00:55:08-04:00" or "...Z". */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

export function parseFrontmatter(raw: unknown, file: string): Frontmatter {
  // A function declaration, not a const arrow: TypeScript only narrows on
  // never-returning calls when the callee is declared this way, and this
  // validator leans on `fail(...)` acting as a type guard throughout.
  function fail(msg: string): never {
    throw new Error(`${file}: ${msg}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail("frontmatter is missing or is not a mapping");
  }
  const data = raw as Record<string, unknown>;

  const str = (key: string, required = true): string => {
    const value = data[key];
    if (value === undefined || value === null || value === "") {
      if (required) fail(`missing required field "${key}"`);
      return "";
    }
    if (typeof value !== "string") {
      return fail(`"${key}" must be a string, got ${typeof value}`);
    }
    return value;
  };

  const bool = (key: string, fallback: boolean): boolean => {
    const value = data[key];
    if (value === undefined) return fallback;
    if (typeof value !== "boolean") {
      return fail(`"${key}" must be true or false, got ${JSON.stringify(value)}`);
    }
    return value;
  };

  // --- date -------------------------------------------------------------
  // gray-matter's YAML parser turns an unquoted timestamp into a JS Date,
  // which loses the authored offset. Quote it in the file; catch it here.
  const rawDate = data.date;
  if (rawDate instanceof Date) {
    fail(
      `"date" was parsed as a YAML timestamp, which drops the timezone offset. ` +
        `Quote it: date: "${rawDate.toISOString()}"`,
    );
  }
  const date = str("date");
  if (!ISO_WITH_OFFSET.test(date)) {
    fail(
      `"date" must be ISO 8601 with an explicit offset (e.g. 2026-01-15T00:55:08-04:00), got "${date}"`,
    );
  }
  if (data.updated instanceof Date) {
    fail(`"updated" was parsed as a YAML timestamp — quote it.`);
  }
  const updated = str("updated", false) || undefined;
  if (updated && !ISO_WITH_OFFSET.test(updated)) {
    fail(`"updated" must be ISO 8601 with an explicit offset, got "${updated}"`);
  }

  // --- author -----------------------------------------------------------
  const author = str("author");
  if (!authors[author]) {
    fail(
      `unknown author "${author}". Known: ${Object.keys(authors).join(", ")}. Add it to lib/authors.ts.`,
    );
  }

  // --- tags -------------------------------------------------------------
  const rawTags = data.tags;
  if (!Array.isArray(rawTags) || rawTags.length === 0) {
    fail(`"tags" must be a non-empty array`);
  }
  const tags = (rawTags as unknown[]).map((tag) => {
    if (typeof tag !== "string") fail(`every entry in "tags" must be a string`);
    if (!(KNOWN_TAGS as readonly string[]).includes(tag as string)) {
      fail(
        `unknown tag "${tag}". Known: ${KNOWN_TAGS.join(", ")}. ` +
          `To add one, extend KNOWN_TAGS and tagLabels in lib/posts.ts — ` +
          `an archive page is generated for every known tag.`,
      );
    }
    return tag as TagSlug;
  });

  // --- hero -------------------------------------------------------------
  const rawHero = data.hero;
  if (typeof rawHero !== "object" || rawHero === null || Array.isArray(rawHero)) {
    fail(`"hero" must be a mapping with at least src, width and height`);
  }
  const heroData = rawHero as Record<string, unknown>;
  const heroSrc = heroData.src;
  if (typeof heroSrc !== "string" || !heroSrc.startsWith("/")) {
    fail(`"hero.src" must be a root-relative path starting with "/"`);
  }
  const dimension = (key: "width" | "height"): number => {
    const value = heroData[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return fail(`"hero.${key}" must be a positive number`);
    }
    return value;
  };
  const hero: ImageSource = {
    src: heroSrc as string,
    width: dimension("width"),
    height: dimension("height"),
    // "" is a meaningful value here (decorative hero), so preserve it exactly.
    alt: typeof heroData.alt === "string" ? heroData.alt : "",
    ...(typeof heroData.srcSet === "string" ? { srcSet: heroData.srcSet } : {}),
    ...(typeof heroData.sizes === "string" ? { sizes: heroData.sizes } : {}),
    ...(typeof heroData.caption === "string" && heroData.caption
      ? { caption: heroData.caption }
      : {}),
  };

  // --- source -----------------------------------------------------------
  const source = (data.source ?? "original") as ContentSource;
  if (!CONTENT_SOURCES.includes(source)) {
    fail(`"source" must be one of ${CONTENT_SOURCES.join(" | ")}, got "${source}"`);
  }


  // --- needsReview ------------------------------------------------------
  const rawNeedsReview = data.needsReview ?? [];
  if (!Array.isArray(rawNeedsReview)) {
    fail(`"needsReview" must be an array (use [] when nothing is pending)`);
  }
  const needsReview = (rawNeedsReview as unknown[]).map((item) => {
    if (typeof item !== "string") fail(`every entry in "needsReview" must be a string`);
    return item as string;
  });

  return {
    title: str("title"),
    date,
    updated,
    author,
    tags,
    excerpt: str("excerpt"),
    hero,
    toc: bool("toc", false),
    draft: bool("draft", false),
    source,
    sourceRef: str("sourceRef", false) || undefined,
    needsReview,
  };
}
