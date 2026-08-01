#!/usr/bin/env node
/**
 * Import the organization's Bluesky posts into news/ as MDX articles.
 *
 *   node scripts/import-bluesky.mjs [--dry-run] [--force] [--since=YYYY-MM-DD] [--limit=N]
 *
 * Re-runnable and idempotent: news/.bluesky-index.json maps each post's rkey
 * to the article folder it produced, and anything already listed is skipped.
 * Because the INDEX (not the post text) is the identity key, editing a post on
 * Bluesky later can never orphan or duplicate a directory.
 *
 * Imported posts are written with `needsReview: [title, alt]`, which
 * lib/content.ts treats as unpublishable. Bluesky posts have no titles and
 * this account's images have no alt text, so a human has to supply both before
 * anything goes live. That is deliberate: a machine-guessed headline must not
 * be able to reach production.
 *
 * The Bluesky account was created 2026-07-12, so it mirrors nothing older.
 * Anything before that needs a Facebook importer (see news/README.md).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  ROOT,
  download,
  escapeMarkdown,
  firstSentence,
  inSiteTimeZone,
  jpegSize,
  readJSON,
  slugify,
  stripMarkdown,
  truncate,
  writeArticle,
  writeJSON,
  yamlString,
} from "./lib/social-import.mjs";

const HANDLE = "faultfoundation.bsky.social";
const API = "https://public.api.bsky.app/xrpc";
const INDEX_PATH = join(ROOT, "news", ".bluesky-index.json");

/** Tags that have archive pages. Must match KNOWN_TAGS in lib/posts.ts. */
const KNOWN_TAGS = new Set(["discussion", "future", "news", "update"]);

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
};
const DRY_RUN = has("--dry-run");
const FORCE = has("--force");
const SINCE = value("since");
const LIMIT = value("limit") ? Number(value("limit")) : Infinity;

// ---------------------------------------------------------------------------

/**
 * Apply richtext facets to a post's text.
 *
 * Facet indices are UTF-8 BYTE offsets, not JS character offsets. Any emoji or
 * curly quote before a link shifts the two apart, so this walks a Buffer and
 * never touches String.prototype.slice. Callers verify the result round-trips.
 */
function applyFacets(text, facets = []) {
  const bytes = Buffer.from(text, "utf8");
  const sorted = [...(facets ?? [])].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );

  let cursor = 0;
  let out = "";
  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < cursor) continue; // overlapping facet; keep the first
    out += escapeMarkdown(bytes.subarray(cursor, byteStart).toString("utf8"));
    const label = bytes.subarray(byteStart, byteEnd).toString("utf8");
    const feature = facet.features?.[0];

    if (feature?.$type === "app.bsky.richtext.facet#link") {
      out += `[${escapeMarkdown(label)}](${feature.uri})`;
    } else if (feature?.$type === "app.bsky.richtext.facet#mention") {
      out += `[${escapeMarkdown(label)}](https://bsky.app/profile/${feature.did})`;
    } else if (feature?.$type === "app.bsky.richtext.facet#tag") {
      const slug = String(feature.tag).toLowerCase();
      // Only link a hashtag if it maps to a real archive page. Inventing
      // /tag/<marketing-hashtag>/ would produce dead links.
      out += KNOWN_TAGS.has(slug)
        ? `[${escapeMarkdown(label)}](/tag/${slug}/)`
        : escapeMarkdown(label);
    } else {
      out += escapeMarkdown(label);
    }
    cursor = byteEnd;
  }
  out += escapeMarkdown(bytes.subarray(cursor).toString("utf8"));
  return out;
}

/** Markdown paragraphs from a social post's line breaks. */
function toParagraphs(markdown) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function imagesOf(post) {
  const embed = post.embed ?? {};
  if (Array.isArray(embed.images)) return embed.images;
  // Quote posts nest the media one level deeper.
  if (Array.isArray(embed.media?.images)) return embed.media.images;
  return [];
}

// ---------------------------------------------------------------------------

const profileRes = await fetch(`${API}/app.bsky.actor.getProfile?actor=${HANDLE}`);
if (!profileRes.ok) {
  throw new Error(`Could not load @${HANDLE}: ${profileRes.status}`);
}
const profile = await profileRes.json();
const DID = profile.did;
console.log(`@${HANDLE} (${DID}) — ${profile.postsCount} posts\n`);

const feed = [];
let cursor;
do {
  const url = new URL(`${API}/app.bsky.feed.getAuthorFeed`);
  url.searchParams.set("actor", HANDLE);
  url.searchParams.set("limit", "100");
  url.searchParams.set("filter", "posts_no_replies");
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getAuthorFeed: ${res.status}`);
  const page = await res.json();
  feed.push(...page.feed);
  cursor = page.cursor;
} while (cursor);

const index = readJSON(INDEX_PATH, {});
const review = [];
let written = 0;
let skipped = 0;

for (const item of feed) {
  if (item.reason) continue; // repost
  const post = item.post;
  const record = post.record;
  if (record.reply) continue;

  const rkey = post.uri.split("/").pop();
  const created = record.createdAt;
  if (SINCE && created < SINCE) continue;

  const local = inSiteTimeZone(created);

  if (index[rkey] && existsSync(join(ROOT, "news", index[rkey], "index.mdx")) && !FORCE) {
    skipped += 1;
    continue;
  }
  if (written >= LIMIT) break;

  // --- body -------------------------------------------------------------
  const markdown = toParagraphs(applyFacets(record.text, record.facets));

  // Guard against the byte/char offset bug class: reassembling the markdown
  // back to plain text must reproduce the post exactly.
  const roundTrip = stripMarkdown(markdown).replace(/\s+/g, " ").trim();
  const original = record.text.replace(/\s+/g, " ").trim();
  if (roundTrip !== original) {
    throw new Error(
      `Facet round-trip failed for ${rkey}.\n  expected: ${original}\n  got:      ${roundTrip}`,
    );
  }

  // --- identity ---------------------------------------------------------
  const title = firstSentence(record.text);
  let slug = index[rkey]?.split("/").pop() ?? slugify(record.text);
  let suffix = 2;
  while (
    !index[rkey] &&
    existsSync(join(ROOT, "news", local.year, local.month, slug))
  ) {
    slug = `${slugify(record.text)}-${suffix++}`;
  }
  const contentId = `${local.year}/${local.month}/${slug}`;

  // --- images -----------------------------------------------------------
  const images = imagesOf(post);
  const mediaDir = join(ROOT, "public", "news", contentId);
  const assets = [];
  for (const [i, image] of images.entries()) {
    const cid = image.fullsize.split("/").pop().split("@")[0];
    const name = `${String(i + 1).padStart(2, "0")}.jpg`;
    // The @jpeg CDN variant is the same pixel dimensions as the original blob
    // at roughly a tenth the bytes (~78 KB vs ~900 KB), so it is the right
    // source even though com.atproto.sync.getBlob would give the true upload.
    const url = `https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/${cid}@jpeg`;
    const dest = join(mediaDir, name);
    if (!DRY_RUN) await download(url, dest, { force: FORCE });
    // Measure what was actually delivered rather than trusting the record's
    // aspectRatio — Bluesky reports 1080x1350 for files its CDN serves at
    // 583x729, and width/height must state the real intrinsic size.
    const measured = DRY_RUN ? null : jpegSize(dest);
    assets.push({
      src: `/news/${contentId}/${name}`,
      width: measured?.width ?? image.aspectRatio?.width ?? 1000,
      height: measured?.height ?? image.aspectRatio?.height ?? 1000,
      alt: image.alt ?? "",
    });
  }

  // --- frontmatter ------------------------------------------------------
  const hero = assets[0];
  const permalink = `https://bsky.app/profile/${HANDLE}/post/${rkey}`;
  // Every image on this account has empty alt text, and the post has no title,
  // so both are flagged. check-content.mjs refuses to publish until cleared.
  const needsReview = ["title"];
  if (assets.some((a) => !a.alt)) needsReview.push("alt");

  const frontmatter = [
    `title: ${yamlString(title)}`,
    `date: ${yamlString(local.iso)}`,
    "author: oscar-labit",
    "tags: [news]",
    `excerpt: ${yamlString(truncate(record.text))}`,
    "hero:",
    `  src: ${yamlString(hero?.src ?? "/wp-content/uploads/2025/10/White-black-border-scaled.png")}`,
    `  width: ${hero?.width ?? 2560}`,
    `  height: ${hero?.height ?? 2560}`,
    `  alt: ${yamlString(hero?.alt ?? "")}`,
    "toc: false",
    "draft: false",
    "source: bluesky-import",
    `sourceRef: ${yamlString(rkey)}`,
    `needsReview: [${needsReview.join(", ")}]`,
  ];

  // The gallery carries the post's images. The "originally posted on Bluesky"
  // link lives in frontmatter, not the body, so it stays out of the excerpt.
  const gallery =
    assets.length > 0
      ? `\n\n<Gallery images={${JSON.stringify(assets)}} />`
      : "";

  if (!DRY_RUN) {
    writeArticle(contentId, frontmatter, markdown + gallery);
    index[rkey] = contentId;
  }
  written += 1;
  review.push({ contentId, images: assets.length, title });
  console.log(`  + news/${contentId}/index.mdx  (${assets.length} images)`);
}

if (!DRY_RUN) writeJSON(INDEX_PATH, index);

console.log(`\n${written} written, ${skipped} skipped${DRY_RUN ? " (dry run)" : ""}`);
if (review.length > 0) {
  console.log("\nNeeds human review before these can publish:");
  for (const entry of review) {
    console.log(
      `  news/${entry.contentId}/index.mdx\n` +
        `     title: "${entry.title}"  <- machine-derived from the first sentence\n` +
        `     alt:   ${entry.images} image(s) have no alt text\n` +
        `     tags:  defaulted to [news]\n` +
        `     then clear needsReview: []`,
    );
  }
}
