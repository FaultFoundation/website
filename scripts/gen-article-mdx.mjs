#!/usr/bin/env node
/**
 * One-shot migration: the three hand-ported WordPress article pages ->
 * news/<YYYY>/<MM>/<slug>/index.mdx.
 *
 * Kept in the repo for provenance, like scripts/gen-policy-sections.mjs (whose
 * whitelist/fail-loud architecture this clones). It is not part of the build
 * and should not need to run again.
 *
 * Reads the PRE-MIGRATION static build in out/, so run it before deleting the
 * legacy app/2025/**, app/2026/** page.tsx files:
 *
 *   npm run build && node scripts/gen-article-mdx.mjs
 *
 * The contract: every tag encountered must be on the whitelist. Anything else
 * throws rather than being silently dropped — losing a sentence quietly is the
 * one failure mode this migration cannot tolerate.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — the repo path contains a space.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Metadata lifted verbatim from the pre-migration lib/posts.ts and each page's
 * `metadata` export. Excerpts in particular are the live og:description
 * strings, already crawled and cached by Google/Facebook/Bluesky — they are
 * copied, never regenerated.
 */
const ARTICLES = [
  {
    contentId: "2025/11/the-fault-foundation-who-we-are-and-whats-next",
    title: "The Fault Foundation: Who We Are and What’s Next",
    date: "2025-11-29T21:01:32-04:00",
    // Stored in the same -04:00 offset as `date`, because the display date is
    // formatted from the literal prefix. og:modifiedTime's UTC form
    // (2026-01-18T01:08:42+00:00) is derived at render time; storing THAT here
    // would render "January 18" where the live site says "January 17".
    updated: "2026-01-17T21:08:42-04:00",
    tags: ["future", "news", "update"],
    hero: {
      src: "/wp-content/uploads/2025/11/IMG_1875-scaled.jpg",
      width: 2560,
      height: 1920,
      srcSet:
        "/wp-content/uploads/2025/11/IMG_1875-scaled.jpg 2560w, /wp-content/uploads/2025/11/IMG_1875-300x225.jpg 300w, /wp-content/uploads/2025/11/IMG_1875-1024x768.jpg 1024w, /wp-content/uploads/2025/11/IMG_1875-768x576.jpg 768w, /wp-content/uploads/2025/11/IMG_1875-1536x1152.jpg 1536w, /wp-content/uploads/2025/11/IMG_1875-2048x1536.jpg 2048w",
      sizes: "(max-width: 2560px) 100vw, 2560px",
    },
    excerpt:
      "We believe the best way to start is with a proper introduction. In this post, we’ll cover who we are, the dedicated team behind the scenes, and the exciting work we have planned for the near future. The Fault Foundation The Fault Foundation was established in July 2025 by five founding members who wanted to […]",
  },
  {
    contentId: "2025/12/discord-and-sharing-personal-information",
    title: "Discord and Sharing Personal Information",
    date: "2025-12-03T13:46:54-04:00",
    updated: "2026-01-15T01:09:09-04:00",
    tags: ["discussion", "update"],
    hero: {
      src: "/wp-content/uploads/2025/12/Discord-and-Sharing-Personal-Information.png",
      width: 1280,
      height: 720,
      srcSet:
        "/wp-content/uploads/2025/12/Discord-and-Sharing-Personal-Information.png 1280w, /wp-content/uploads/2025/12/Discord-and-Sharing-Personal-Information-300x169.png 300w, /wp-content/uploads/2025/12/Discord-and-Sharing-Personal-Information-1024x576.png 1024w, /wp-content/uploads/2025/12/Discord-and-Sharing-Personal-Information-768x432.png 768w",
      sizes: "(max-width: 1280px) 100vw, 1280px",
    },
    excerpt:
      "Privacy is a sensitive topic. We’ve heard concerns from some members about sharing personal information through our verification process, and we want to address those concerns directly and honestly. We’re trying to work with and provide a service to people, not users. That distinction matters to us. Users are metrics on a dashboard. People are individuals with concerns, […]",
  },
  {
    contentId: "2026/01/community-verification",
    title: "Community Verification",
    date: "2026-01-15T00:55:08-04:00",
    tags: ["discussion"],
    hero: {
      src: "/wp-content/uploads/2026/01/Community-Verification.png",
      width: 1280,
      height: 720,
      srcSet:
        "/wp-content/uploads/2026/01/Community-Verification.png 1280w, /wp-content/uploads/2026/01/Community-Verification-300x169.png 300w, /wp-content/uploads/2026/01/Community-Verification-1024x576.png 1024w, /wp-content/uploads/2026/01/Community-Verification-768x432.png 768w",
      sizes: "(max-width: 1280px) 100vw, 1280px",
    },
    excerpt:
      "Hello everyone! We’re glad you’re interested in the Fault Foundation Discord community. This short post explains more information regarding the verification process. Protection To keep our community safe and minimize spam or abuse, you’ll notice new accounts have limited access to the channels within the “Public” category. We’ve decided to add this barrier to protect […]",
  },
];

// ---------------------------------------------------------------------------
// Tiny HTML reader (the built markup is machine-generated and well-formed).
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(["img", "br", "hr", "meta", "link", "input"]);

function parseNodes(html) {
  const nodes = [];
  const stack = [{ children: nodes }];
  const re = /<(\/?)([a-zA-Z0-9-]+)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let last = 0;
  let match;
  while ((match = re.exec(html))) {
    const [full, closing, tag, attrs, selfClose] = match;
    if (match.index > last) {
      pushText(stack, html.slice(last, match.index));
    }
    last = match.index + full.length;
    const name = tag.toLowerCase();
    if (closing) {
      // Find the matching open tag; ignore strays.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === name) {
          stack.length = i;
          break;
        }
      }
    } else if (selfClose || VOID_TAGS.has(name)) {
      stack[stack.length - 1].children.push({
        tag: name,
        attrs: parseAttrs(attrs),
        children: [],
      });
    } else {
      const node = { tag: name, attrs: parseAttrs(attrs), children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }
  if (last < html.length) pushText(stack, html.slice(last));
  return nodes;
}

function pushText(stack, raw) {
  if (!raw) return;
  stack[stack.length - 1].children.push({ text: raw });
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([a-zA-Z0-9:_-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(source))) attrs[m[1].toLowerCase()] = m[2];
  return attrs;
}

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, body) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return ENTITIES[body] ?? full;
  });
}

// ---------------------------------------------------------------------------
// HTML -> Markdown
// ---------------------------------------------------------------------------

/** Characters that would otherwise be read as Markdown/MDX syntax. */
function escapeText(text) {
  return text
    .replace(/([\\`*_[\]{}<>])/g, "\\$1")
    // A line that starts with "#", "-", "+" or "1." would become a block.
    .replace(/^(\s*)([#>+-])/gm, "$1\\$2")
    .replace(/^(\s*\d+)\./gm, "$1\\.");
}

function collapse(text) {
  return text.replace(/\s+/g, " ");
}

/**
 * Wrap inline content in Markdown markers, hoisting any leading/trailing
 * whitespace OUTSIDE them.
 *
 * This matters more than it looks. The source contains
 * `<a href="/roadmap/">here </a>(https://…)` — the separating space lives
 * *inside* the anchor. Trimming it would emit `[here](/roadmap/)(https://…)`,
 * which renders as "here(https://…)" and silently loses a character.
 * `**bold **` is likewise invalid Markdown and must become `**bold** `.
 */
function wrap(raw, open, close) {
  const core = raw.trim();
  if (!core) return raw ? " " : "";
  const lead = raw.slice(0, raw.length - raw.trimStart().length);
  const trail = raw.slice(raw.trimEnd().length);
  return `${lead}${open}${core}${close}${trail}`;
}

/** Inline content -> Markdown string. */
function inline(nodes, file) {
  let out = "";
  for (const node of nodes) {
    if (node.text !== undefined) {
      out += escapeText(collapse(decodeEntities(node.text)));
      continue;
    }
    switch (node.tag) {
      case "strong":
      case "b":
        out += wrap(inline(node.children, file), "**", "**");
        break;
      case "em":
      case "i":
        out += wrap(inline(node.children, file), "_", "_");
        break;
      case "a": {
        const href = node.attrs.href ?? "";
        out += wrap(inline(node.children, file), "[", `](${href})`);
        break;
      }
      case "br":
        out += "\n";
        break;
      case "span":
        out += inline(node.children, file);
        break;
      default:
        throw new Error(
          `${file}: unhandled inline tag <${node.tag}>. Add it to the whitelist in scripts/gen-article-mdx.mjs.`,
        );
    }
  }
  return out;
}

/**
 * Collapse runs of spaces introduced by the HTML's own formatting. No
 * punctuation "fixups" — a rule like / +([.,])/ -> "$1" would silently edit
 * the author's words, which is exactly what this migration must not do.
 */
function tidy(markdown) {
  return markdown.replace(/ {2,}/g, " ").trim();
}

/**
 * Block content -> array of Markdown blocks.
 *
 * `shallowest` is the smallest heading level present in the document. It maps
 * to "##", and each level deeper maps one deeper, so a document using <h1> for
 * sections and <h2> for subsections becomes ## / ###. The <h1> is now the
 * article title rendered by the template, which is also an accessibility fix:
 * the legacy pages used <h1> for every section.
 */
function blocks(nodes, file, shallowest) {
  const out = [];
  for (const node of nodes) {
    if (node.text !== undefined) {
      if (decodeEntities(node.text).trim()) {
        throw new Error(`${file}: bare text outside a block: ${node.text.trim()}`);
      }
      continue;
    }
    switch (node.tag) {
      case "div":
        // wp-block-group is a layout wrapper with no semantics. Unwrap it.
        out.push(...blocks(node.children, file, shallowest));
        break;
      case "p": {
        const text = tidy(inline(node.children, file));
        if (text) out.push(text);
        break;
      }
      case "h1":
      case "h2":
      case "h3": {
        const depth = 2 + (Number(node.tag[1]) - shallowest);
        out.push(`${"#".repeat(depth)} ${tidy(inline(node.children, file))}`);
        break;
      }
      case "ul":
      case "ol": {
        const items = node.children.filter((child) => child.tag === "li");
        const lines = items.map((item, index) => {
          const marker = node.tag === "ul" ? "-" : `${index + 1}.`;
          return `${marker} ${tidy(inline(item.children, file))}`;
        });
        out.push(lines.join("\n"));
        break;
      }
      case "blockquote": {
        const inner = blocks(node.children, file, shallowest);
        out.push(
          inner
            .join("\n\n")
            .split("\n")
            .map((line) => (line ? `> ${line}` : ">"))
            .join("\n"),
        );
        break;
      }
      default:
        throw new Error(
          `${file}: unhandled block tag <${node.tag}>. Add it to the whitelist in scripts/gen-article-mdx.mjs.`,
        );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

function extractEntryContent(html, file) {
  const open = /<div class="entry-content[^"]*"[^>]*>/.exec(html);
  if (!open) throw new Error(`${file}: no .entry-content div found`);
  let depth = 1;
  const rest = html.slice(open.index + open[0].length);
  const re = /<(\/?)div\b[^>]*>/g;
  let m;
  while ((m = re.exec(rest))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return rest.slice(0, m.index);
  }
  throw new Error(`${file}: unbalanced .entry-content div`);
}

function yamlString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildFrontmatter(article) {
  const lines = [
    "---",
    `title: ${yamlString(article.title)}`,
    // Quoted so the YAML parser keeps it a string: an unquoted timestamp
    // becomes a JS Date and loses the -04:00 offset the display date needs.
    `date: ${yamlString(article.date)}`,
  ];
  if (article.updated) lines.push(`updated: ${yamlString(article.updated)}`);
  lines.push(
    "author: oscar-labit",
    `tags: [${article.tags.join(", ")}]`,
    `excerpt: ${yamlString(article.excerpt)}`,
    "hero:",
    `  src: ${yamlString(article.hero.src)}`,
    `  width: ${article.hero.width}`,
    `  height: ${article.hero.height}`,
    `  alt: ""`,
    `  srcSet: ${yamlString(article.hero.srcSet)}`,
    `  sizes: ${yamlString(article.hero.sizes)}`,
    "toc: false",
    "draft: false",
    "source: original",
    "needsReview: []",
    "---",
  );
  return lines.join("\n");
}

let written = 0;
for (const article of ARTICLES) {
  const htmlPath = join(ROOT, "out", article.contentId, "index.html");
  if (!existsSync(htmlPath)) {
    throw new Error(
      `${htmlPath} not found. Run \`npm run build\` on the PRE-migration tree first.`,
    );
  }
  const html = readFileSync(htmlPath, "utf8");
  const inner = extractEntryContent(html, article.contentId);
  const nodes = parseNodes(inner);

  const levels = [];
  const collectLevels = (list) => {
    for (const node of list) {
      if (node.tag && /^h[1-6]$/.test(node.tag)) levels.push(Number(node.tag[1]));
      if (node.children) collectLevels(node.children);
    }
  };
  collectLevels(nodes);
  const shallowest = levels.length ? Math.min(...levels) : 1;
  const body = blocks(nodes, article.contentId, shallowest);

  const outPath = join(ROOT, "news", article.contentId, "index.mdx");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${buildFrontmatter(article)}\n\n${body.join("\n\n")}\n`);
  console.log(
    `wrote news/${article.contentId}/index.mdx (${body.length} blocks, h${shallowest} -> h2)`,
  );
  written += 1;
}
console.log(`\n${written} article(s) migrated. Hand-review each before building.`);
