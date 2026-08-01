/**
 * Shared helpers for importing social posts into news/ MDX articles.
 *
 * Deliberately network- and platform-agnostic: scripts/import-bluesky.mjs is a
 * thin adapter over this, and a future scripts/import-facebook.mjs should be
 * one too. (Bluesky only mirrors posts from 2026-07-12 onward, so a Facebook
 * path will eventually be needed for anything older.)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — the repo path can contain spaces.
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The offset every existing article on this site is authored in. */
export const SITE_TZ = "America/New_York";

/**
 * Split an instant into the site's local calendar fields plus an ISO string
 * carrying that local offset.
 *
 * The folder path is derived from the LOCAL date. Slicing YYYY/MM off a UTC
 * string would file a 9pm-Eastern post into the following month whenever it
 * lands near a month boundary.
 */
export function inSiteTimeZone(instantISO) {
  const date = new Date(instantISO);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  // hour12:false yields "24" for midnight in some ICU versions.
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");

  const asUTC = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(hour),
    Number(get("minute")),
    Number(get("second")),
  );
  const offsetMin = Math.round((asUTC - date.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(
    abs % 60,
  ).padStart(2, "0")}`;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    iso: `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}${offset}`,
  };
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "our", "we", "us", "it", "its", "at", "by",
]);

/** URL-safe slug from a sentence: <= 8 meaningful words, <= 60 chars. */
export function slugify(text, { maxWords = 8, maxChars = 60 } = {}) {
  const words = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\S+/g, " ")
    .toLowerCase()
    // Strip anything that is not a letter, number or space (drops emoji too).
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const kept = [];
  for (const word of words) {
    if (kept.length >= maxWords) break;
    // Keep a leading stop word only if nothing meaningful has been kept yet.
    if (STOP_WORDS.has(word) && kept.length > 0) continue;
    if (STOP_WORDS.has(word) && kept.length === 0) continue;
    kept.push(word);
  }
  let slug = kept.join("-").slice(0, maxChars).replace(/-+$/g, "");
  if (!slug) slug = "post";
  return slug;
}

/** First sentence, trimmed of trailing punctuation, for a provisional title. */
export function firstSentence(text, maxChars = 60) {
  const cleaned = text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  const match = /^(.+?)([.!?]|$)/.exec(cleaned);
  let sentence = (match ? match[1] : cleaned).trim();
  if (sentence.length > maxChars) {
    sentence = sentence.slice(0, maxChars).replace(/\s+\S*$/, "").trim() + "…";
  }
  return sentence.replace(/[,;:]$/, "");
}

/** Word-boundary truncation for excerpts. */
export function truncate(text, maxChars = 200) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars).replace(/\s+\S*$/, "").trim() + "…";
}

export function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Escape Markdown/MDX-significant characters in a plain-text run. */
export function escapeMarkdown(text) {
  return text
    .replace(/([\\`*_[\]{}<>])/g, "\\$1")
    .replace(/^(\s*)([#>+-])/gm, "$1\\$2")
    .replace(/^(\s*\d+)\./gm, "$1\\.");
}

/** Remove markdown link syntax and escapes, recovering the original text. */
export function stripMarkdown(markdown) {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_[\]{}<>#>+.-])/g, "$1");
}

export function readJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJSON(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function writeArticle(contentId, frontmatterLines, body) {
  const outPath = join(ROOT, "news", contentId, "index.mdx");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `---\n${frontmatterLines.join("\n")}\n---\n\n${body.trim()}\n`,
  );
  return outPath;
}

/**
 * Actual pixel dimensions of a baseline/progressive JPEG, read from its SOF
 * marker. Dependency-free on purpose.
 *
 * Needed because a platform's declared aspectRatio is not the delivered size:
 * Bluesky reports 1080x1350 for images its CDN serves at 583x729. Writing the
 * declared numbers into width/height would misstate the intrinsic size.
 */
export function jpegSize(path) {
  const buf = readFileSync(path);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

/** Download to disk, skipping if already present (unless force). */
export async function download(url, destPath, { force = false } = {}) {
  if (!force && existsSync(destPath)) return { skipped: true, bytes: 0 };
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buffer);
  return { skipped: false, bytes: buffer.length };
}
