#!/usr/bin/env node
/**
 * Content lint. Wired to `prebuild`, so `npm run build` fails on a broken
 * article rather than shipping one.
 *
 * lib/content/frontmatter.ts already validates field types and values during
 * the build. This covers what the type system cannot see:
 *
 *   - every referenced image actually exists under public/
 *   - gallery/body images carry alt text
 *   - articles still flagged needsReview are reported (they are excluded from
 *     the build, so this is the reminder that they exist)
 *
 * Run directly for the full report: node scripts/check-content.mjs
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEWS = join(ROOT, "news");
const PUBLIC = join(ROOT, "public");

const errors = [];
const warnings = [];
const pending = [];

function contentIds() {
  if (!existsSync(NEWS)) return [];
  const dirs = (dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  const ids = [];
  for (const year of dirs(NEWS)) {
    if (!/^\d{4}$/.test(year)) continue;
    for (const month of dirs(join(NEWS, year))) {
      if (!/^\d{2}$/.test(month)) continue;
      for (const slug of dirs(join(NEWS, year, month))) {
        if (existsSync(join(NEWS, year, month, slug, "index.mdx"))) {
          ids.push(`${year}/${month}/${slug}`);
        }
      }
    }
  }
  return ids;
}

/** Local-path image references in the body: ![alt](/x) and src="/x". */
function bodyImageRefs(body) {
  const refs = [];
  for (const m of body.matchAll(/!\[([^\]]*)\]\((\/[^)\s]+)\)/g)) {
    refs.push({ src: m[2], alt: m[1], kind: "markdown image" });
  }
  // <Gallery images={[...]} /> and <Figure src="..." alt="..." />
  for (const m of body.matchAll(/"src"\s*:\s*"(\/[^"]+)"\s*,\s*"width"[^}]*?"alt"\s*:\s*"([^"]*)"/g)) {
    refs.push({ src: m[1], alt: m[2], kind: "gallery image" });
  }
  for (const m of body.matchAll(/<Figure\b[^>]*?src="(\/[^"]+)"[^>]*?alt="([^"]*)"/g)) {
    refs.push({ src: m[1], alt: m[2], kind: "Figure" });
  }
  return refs;
}

const ids = contentIds();
for (const id of ids) {
  const file = `news/${id}/index.mdx`;
  const parsed = matter(readFileSync(join(NEWS, id, "index.mdx"), "utf8"));
  const fm = parsed.data ?? {};

  // An unquoted YAML timestamp becomes a Date and silently loses the authored
  // offset, which shifts the rendered date by up to a day.
  for (const key of ["date", "updated"]) {
    if (fm[key] instanceof Date) {
      errors.push(`${file}: "${key}" must be QUOTED so the timezone offset survives`);
    }
  }

  const hero = fm.hero ?? {};
  if (typeof hero.src === "string" && hero.src.startsWith("/")) {
    if (!existsSync(join(PUBLIC, hero.src))) {
      errors.push(`${file}: hero.src not found -> public${hero.src}`);
    }
  }

  for (const ref of bodyImageRefs(parsed.content)) {
    if (!existsSync(join(PUBLIC, ref.src))) {
      errors.push(`${file}: ${ref.kind} not found -> public${ref.src}`);
    }
    // A hero may be decorative; a gallery carrying the whole post's content
    // may not.
    if (!ref.alt.trim()) {
      warnings.push(`${file}: ${ref.kind} has no alt text -> ${ref.src}`);
    }
  }

  const needsReview = Array.isArray(fm.needsReview) ? fm.needsReview : [];
  if (needsReview.length > 0) {
    pending.push(`${file}: needsReview [${needsReview.join(", ")}] — excluded from the build`);
  }
}

console.log(`content lint: ${ids.length} article(s)`);
for (const line of pending) console.log(`  PENDING  ${line}`);
for (const line of warnings) console.log(`  WARN     ${line}`);
for (const line of errors) console.log(`  ERROR    ${line}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s). Build stopped.`);
  process.exit(1);
}
console.log(
  `  ok (${warnings.length} warning(s), ${pending.length} awaiting review)`,
);
