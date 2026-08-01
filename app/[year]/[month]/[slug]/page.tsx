import type { Metadata } from "next";

import {
  ArticleHeader,
  ArticleHero,
  ArticlePrevNext,
  ArticleRelated,
  ArticleToc,
} from "@/components/article/ArticleChrome";
import { getAllPosts, getPost, getRelated } from "@/lib/content";

/** Only the articles discovered under news/ exist; anything else 404s. */
export const dynamicParams = false;

type Params = { year: string; month: string; slug: string };

export function generateStaticParams(): Params[] {
  return getAllPosts().map(({ year, month, slug }) => ({ year, month, slug }));
}

/**
 * "2026-01-15T00:55:08-04:00" -> "2026-01-15T04:55:08+00:00", the exact shape
 * the WordPress pages emitted for article:published_time. Date is safe here:
 * this is a machine-readable instant, not the human-facing display date (which
 * must come from the literal string prefix — see formatDateDisplay).
 */
function toUtcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { year, month, slug } = await params;
  const post = getPost(year, month, slug);
  if (!post) return {};
  return {
    title: post.title,
    alternates: { canonical: post.href },
    openGraph: {
      description: post.excerpt,
      images: [post.image.src],
      type: "article",
      publishedTime: toUtcStamp(post.dateISO),
      ...(post.updatedISO ? { modifiedTime: toUtcStamp(post.updatedISO) } : {}),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { year, month, slug } = await params;
  const post = getPost(year, month, slug);
  if (!post) return null;

  // Single-variable dynamic import: webpack builds ONE context module for
  // news/**\/index.mdx. Interpolating year/month/slug separately makes the
  // pattern far more fragile — keep it as one `rel`. If this ever breaks
  // (e.g. under Turbopack) see news/README.md for the registry escape hatch.
  const rel = `${year}/${month}/${slug}`;
  const { default: MDXBody } = await import(`@/news/${rel}/index.mdx`);

  const all = getAllPosts();
  const index = all.findIndex((entry) => entry.contentId === post.contentId);
  // `all` is newest-first, so the NEXT item in the array is the OLDER post.
  const newer = index > 0 ? all[index - 1] : undefined;
  const older = index >= 0 && index < all.length - 1 ? all[index + 1] : undefined;

  const showToc = post.frontmatter.toc && post.headings.length > 1;

  return (
    <main id="wp--skip-link--target" className="ff-main ff-article">
      <article>
        <div className="ff-container">
          <ArticleHeader post={post} />
        </div>

        <div className="ff-container">
          <ArticleHero post={post} />
        </div>

        <div
          className={`ff-container ff-article__layout${
            showToc ? " ff-article__layout--toc" : ""
          }`}
        >
          <div className="ff-article__body ff-prose ff-prose--article">
            <MDXBody />
          </div>
          {showToc && <ArticleToc headings={post.headings} />}
        </div>

        <footer className="ff-article__footer ff-container">
          <div className="ff-article__footer-inner">
            <ArticlePrevNext previous={older} next={newer} />
          </div>
        </footer>
      </article>

      <ArticleRelated posts={getRelated(post)} />
    </main>
  );
}
