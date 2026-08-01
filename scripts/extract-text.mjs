#!/usr/bin/env node
/**
 * Content-fidelity QA: extract the normalized visible text of every route's
 * MAIN CONTENT (header/footer/nav/TOC/carousel chrome removed) so a redesign
 * can be diffed against a pre-redesign baseline to prove the words didn't
 * change.
 *
 * Usage: node scripts/extract-text.mjs <outDir>
 *   e.g. node scripts/extract-text.mjs reference/text-baseline
 * Assumes the static build is served at http://localhost:3999
 * (npx serve out -l 3999), same as screenshot-compare.mjs.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const BASE = "http://localhost:3999";
const OUT = "out";

/**
 * Every route in the build, discovered by globbing out/**\/index.html, so
 * articles added after this script was written are covered automatically.
 * The name is the route with slashes turned into dashes ("/" -> "home"),
 * which keeps baseline filenames stable across runs.
 */
function discoverRoutes() {
  const routes = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // _next holds build assets, not routes.
        if (entry.name !== "_next") walk(full);
      } else if (entry.name === "index.html") {
        const rel = relative(OUT, dir).split(sep).filter(Boolean);
        routes[rel.length ? rel.join("-") : "home"] =
          "/" + (rel.length ? rel.join("/") + "/" : "");
      }
    }
  };
  walk(OUT);
  // 404 is not reachable by globbing — it is served for unknown paths.
  routes["404"] = "/definitely-not-a-page/";
  return Object.fromEntries(Object.entries(routes).sort());
}

// Chrome that is NOT page content, in the old (wp-*) and new (ff-*) markup.
// Removed before text extraction.
const CHROME_SELECTORS = [
  // Class-scoped, NOT bare "header"/"footer": an article uses those elements
  // semantically, and a blanket rule would hide its <h1> from the diff — the
  // one heading most worth verifying. Verified safe to narrow: the legacy
  // article markup contained no <header>/<footer> at all, so this produces an
  // identical baseline for the pre-migration build.
  ".ff-header",
  ".ff-footer",
  "nav",
  "givebutter-widget",
  ".skip-link", // old in-page skip link (now lives in the header)
  ".ff-skip-link",
  ".sticky-sidebar", // old policy related-docs sidebar
  ".ff-toc", // policy + article TOC (repeats existing headings)
  ".ff-carousel", // promo slideshow (reuses existing strings)
  // Article-redesign chrome. These match nothing in the pre-redesign build,
  // so adding them here does not perturb the baseline — that is the point:
  // the same script must produce the old baseline and the new capture.
  ".ff-article__breadcrumb",
  ".ff-article__footer",
  ".ff-article__meta", // date · author · reading time
  ".ff-article__tags",
  ".ff-article__social", // "also posted on ..." links
  ".ff-article__prev-next",
  ".ff-article__anchor", // heading permalink "#"
  ".ff-article-share",
  ".ff-article-related", // repeats other posts' titles/excerpts
].join(", ");

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: node scripts/extract-text.mjs <outDir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const ROUTES = discoverRoutes();
console.log(`${Object.keys(ROUTES).length} routes discovered in ${OUT}/`);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, route] of Object.entries(ROUTES)) {
  await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
  const text = await page.evaluate((chromeSel) => {
    document.querySelectorAll(chromeSel).forEach((el) => el.remove());
    // innerText skips closed <details> bodies — force everything open.
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    return document.body.innerText;
  }, CHROME_SELECTORS);
  // Normalize: one word per line so diffs pinpoint exact word changes.
  const normalized = text.replace(/\s+/g, "\n").trim() + "\n";
  writeFileSync(`${outDir}/${name}.txt`, normalized);
  console.log(`${name} (${normalized.split("\n").length} words)`);
}
await browser.close();
