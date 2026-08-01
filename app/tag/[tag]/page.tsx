import type { Metadata } from "next";

import { NewsCard } from "@/components/NewsCard";
import { getAllTags, getPostsByTag } from "@/lib/content";
import { tagLabels, type TagSlug } from "@/lib/posts";

export const dynamicParams = false;

type Params = { tag: string };

/**
 * A page for every KNOWN_TAG, not just tags that currently have visible posts
 * — otherwise a tag archive would start 404ing the moment its only article
 * became a draft, breaking links that are already published.
 */
export function generateStaticParams(): Params[] {
  return getAllTags().map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag } = await params;
  const label = tagLabels[tag as TagSlug];
  return {
    // "future Archives" — the label casing is the live <title> string.
    title: `${label} Archives`,
    alternates: { canonical: `/tag/${tag}/` },
  };
}

export default async function TagArchivePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tag } = await params;
  const slug = tag as TagSlug;
  const posts = getPostsByTag(slug);

  return (
    <main id="wp--skip-link--target" className="ff-main">
      <div className="ff-container">
        <h1 className="ff-archive-title">
          Tag: <span>{tagLabels[slug]}</span>
        </h1>
        {posts.length > 0 ? (
          <div className="ff-news-grid">
            {posts.map((post) => (
              <NewsCard key={post.href} post={post} />
            ))}
          </div>
        ) : (
          <p className="ff-card ff-notfound">No posts with this tag yet.</p>
        )}
      </div>
    </main>
  );
}
