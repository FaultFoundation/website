# `news/` — articles

Every news article lives here as MDX, one folder per article:

```
news/<YYYY>/<MM>/<slug>/index.mdx     ->  https://fault.foundation/<YYYY>/<MM>/<slug>/
public/news/<YYYY>/<MM>/<slug>/*      ->  that article's images
```

The folder path **is** the URL. `app/[year]/[month]/[slug]/page.tsx` enumerates
these folders at build time, so adding a folder is all it takes — no route, no
list to update, no sitemap entry. Tag archives and `sitemap.xml` are derived
too.

`.bluesky-index.json` is machine-written — `scripts/import-bluesky.mjs` uses it
to remember which Bluesky post produced which folder. Leave it to the tooling.

---

## Writing a new article

```sh
mkdir -p news/2026/08/my-article public/news/2026/08/my-article
$EDITOR news/2026/08/my-article/index.mdx
npm run dev            # drafts are visible in dev
npm run check:content  # same lint the build runs
```

Start from this and delete what you don't need:

```mdx
---
title: "A clear, specific headline"
date: "2026-08-14T10:30:00-04:00"
author: oscar-labit
tags: [news, update]
excerpt: "One or two sentences. This is the preview text on /news/ and the description social platforms show when the link is shared."
hero:
  src: /news/2026/08/my-article/hero.png
  width: 1280
  height: 720
  alt: ""
toc: false
draft: false
needsReview: []
---

Opening paragraph. Write in Markdown; `##` is the top heading level, because
the `<h1>` is the title above.

## A section

Regular prose, [links](/about/), **bold**, _italic_, lists, tables.
```

### The date rule (the one thing that will bite you)

**Always quote the date, and always include the offset** — `"-04:00"` in
summer, `"-05:00"` in winter.

Unquoted, YAML parses it as a timestamp and throws the offset away; the article
would then display the wrong day. The build fails loudly if you forget, and
`formatDateDisplay` in `lib/posts.ts` reads the literal `YYYY-MM-DD` prefix
rather than constructing a `Date`, for the same reason.

The `<YYYY>/<MM>` folder must agree with the date. The build fails if it
doesn't.

---

## Frontmatter reference

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Rendered as the `<h1>` and used in `<title>`. |
| `date` | yes | Quoted ISO 8601 **with offset**. Sets the URL and the byline. |
| `updated` | no | Same format. Shows "Updated …" and sets `og:modifiedTime`. |
| `author` | yes | A key from `lib/authors.ts`. Currently `oscar-labit`. |
| `tags` | yes | Non-empty. Must all be in `KNOWN_TAGS` (`lib/posts.ts`). |
| `excerpt` | yes | Card preview + `og:description`. Write it deliberately. |
| `hero.src` | yes | Root-relative path to a file in `public/`. |
| `hero.width` / `hero.height` | yes | The image's real pixel size. |
| `hero.alt` | no | `""` means decorative. Fine for a hero; not for content images. |
| `hero.srcSet` / `hero.sizes` | no | Only the three migrated WordPress posts use these. |
| `hero.caption` | no | Shown under the hero. |
| `toc` | no | `true` adds a sticky table of contents (needs 2+ `##` headings). Default `false` — a TOC on a four-minute read is noise. |
| `draft` | no | `true` hides it everywhere except `npm run dev`. |
| `source` | no | `original`, `bluesky-import`, `facebook-import`. |
| `sourceRef` | no | Set by importers for idempotency. Don't edit. |
| `needsReview` | no | **Non-empty means the article will not publish.** |

### Adding a new tag

Tags are a closed set so a tag chip can never link to a 404. To add one, edit
`KNOWN_TAGS` and `tagLabels` in `lib/posts.ts` — the archive page at
`/tag/<slug>/` is generated automatically. An unknown tag fails the build with
a message telling you this.

---

## Components available in MDX

No imports needed; they come from `mdx-components.tsx`.

```mdx
<Callout label="Note">
Short aside that shouldn't interrupt the flow.
</Callout>

<Callout variant="warn" label="Heads up">
Same, in warm amber.
</Callout>

<PullQuote cite="Oscar Labit, President">
A sentence worth setting apart at large size.
</PullQuote>

<Figure
  src="/news/2026/08/my-article/chart.png"
  alt="Describe what the image shows."
  width={1200} height={675}
  caption="Shown under the image."
/>

<YouTube id="hQqR4tKRiKs" title="How to read a privacy policy" />

<Gallery images={[
  { src: "/news/2026/08/my-article/01.jpg", width: 720, height: 900, alt: "…" },
  { src: "/news/2026/08/my-article/02.jpg", width: 720, height: 900, alt: "…" }
]} />
```

Notes:

- **`<YouTube>` doesn't contact Google until the reader clicks.** It renders a
  poster with a play button and only then loads `youtube-nocookie.com`. Please
  keep it that way — we publish articles about not leaking people's data.
- **`<Gallery>`** never autoplays. One image renders as a plain figure.
- `<Figure full>` breaks out to the full page width; by default figures,
  galleries, embeds and tables sit slightly wider than the text column, and
  everything else stays within the ~70-character reading measure.

### Images and alt text

Put article images in `public/news/<YYYY>/<MM>/<slug>/` and reference them by
root-relative path. `npm run check:content` fails the build if a referenced
file is missing and warns about any content image with empty alt text.

The three migrated WordPress posts keep their images at the original
`public/wp-content/uploads/...` paths on purpose: those URLs are already
crawled and cached by Google, Facebook and Bluesky, so moving them would only
lose reputation. New articles should use `public/news/`.

---

## Publishing

An article goes live as soon as it is merged and Cloudflare rebuilds — provided
`draft` is false and `needsReview` is empty.

The order that works well: **publish the article first, then schedule the social
post in Buffer** pointing at its URL. The link is already live when the post
goes out, so there is nothing to coordinate.

To hold an article back, set `draft: true` (or leave something in
`needsReview`). Either way it still renders in `npm run dev`, so you can see
your own work. For a shareable preview URL, set `INCLUDE_DRAFTS=1` — e.g. as a
branch-scoped environment variable on Cloudflare preview deployments.

### Social links in the article header

The dimmed icon row under the tags comes from `lib/socials.ts`, and is the same
on every article. Add an account by adding an entry there.

## Importing social posts

```sh
npm run import:bluesky              # writes any post not already imported
node scripts/import-bluesky.mjs --dry-run
node scripts/import-bluesky.mjs --since=2026-07-01 --limit=5
```

Safe to re-run: `.bluesky-index.json` records which post produced which folder,
so existing articles are skipped.

Imported articles land with **`needsReview: [title, alt]`**, which keeps them
out of the build until a human has:

1. replaced the machine-derived title (it's just the first sentence),
2. written real alt text for every gallery image,
3. checked the tags (everything defaults to `[news]`),

then cleared it to `needsReview: []`.

**The Bluesky account was created 2026-07-12 and mirrors nothing older.** For
earlier Facebook posts, `scripts/lib/social-import.mjs` holds the reusable
half (slugs, frontmatter, image download, timezone handling); a Facebook
adapter would be a thin script over it, fed by a Meta "Download Your
Information" export or a Page access token.

---

## How this fits together

| Path | Role |
|---|---|
| `lib/content.ts` | Reads these folders. The only module that touches `node:fs`. |
| `lib/content/frontmatter.ts` | Validates frontmatter; every failure names the file and field. |
| `lib/posts.ts` | Types, `KNOWN_TAGS`, `tagLabels`, date formatting. Kept `fs`-free because components import it. |
| `app/[year]/[month]/[slug]/page.tsx` | The article route. |
| `components/article/` | Header, hero, TOC, share button, gallery, embeds. |
| `lib/socials.ts` | The organization's social accounts (icon row). |
| `styles/theme.css` §16 | All `ff-article-*` styling. |
| `scripts/check-content.mjs` | The lint. Runs automatically via `prebuild`. |
| `scripts/gen-article-mdx.mjs` | One-shot WordPress→MDX migration, kept for provenance. |

### If the build ever stops finding MDX

`app/[year]/[month]/[slug]/page.tsx` loads content with a single-variable
dynamic import:

```ts
const rel = `${year}/${month}/${slug}`;
const { default: MDXBody } = await import(`@/news/${rel}/index.mdx`);
```

Webpack turns that into one context module over `news/**/index.mdx`. If a
future Next.js (Turbopack by default) breaks it, the escape hatch is to
generate an explicit registry — have `check-content.mjs` emit
`news/registry.generated.ts` mapping each content id to a static
`() => import("./2026/08/my-article/index.mdx")`, and swap that one line. Keep
`rel` as a single interpolation either way; splitting it into three makes the
pattern much more fragile.
