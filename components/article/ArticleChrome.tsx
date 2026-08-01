/**
 * Server-rendered article chrome: header, hero, TOC, prev/next and related
 * posts.
 *
 * Everything here carries a class listed in CHROME_SELECTORS in
 * scripts/extract-text.mjs, so it is excluded from the content text diff that
 * guards the migrated copy.
 */

import { ArticleShare } from "@/components/article/ArticleShare";
import { NewsCard } from "@/components/NewsCard";
import { getAuthor } from "@/lib/authors";
import type { Heading, LoadedPost } from "@/lib/content";
import { formatDateDisplay, tagLabels } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";
import { socials } from "@/lib/socials";

/** Dimmed brand icons linking to the organization's accounts. */
function SocialIcons() {
  if (socials.length === 0) return null;
  return (
    <div className="ff-article__socials">
      {socials.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={social.label}
          title={social.label}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d={social.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}

export function ArticleHeader({ post }: { post: LoadedPost }) {
  const author = getAuthor(post.authorKey);
  return (
    <header className="ff-article__header">
      <a className="ff-article__breadcrumb" href="/news/">
        ← News
      </a>
      <h1 className="ff-article__title">{post.title}</h1>
      <div className="ff-article__meta">
        <span>
          <time dateTime={post.dateISO}>{post.dateDisplay}</time>
        </span>
        <span>
          <a href={author.path}>{author.name}</a>
        </span>
        <span>{post.readingMinutes} min read</span>
        {post.updatedISO && (
          <span>
            Updated{" "}
            <time dateTime={post.updatedISO}>
              {formatDateDisplay(post.updatedISO)}
            </time>
          </span>
        )}
      </div>
      <div className="ff-article__tags">
        {post.tags.map((tag) => (
          <a key={tag} className="ff-chip" href={`/tag/${tag}/`} rel="tag">
            {tagLabels[tag]}
          </a>
        ))}
      </div>
      {/* Share sits left of the accounts: one row of icon-sized controls,
          rather than a lone button stranded in the footer. */}
      <div className="ff-article__actions">
        <ArticleShare
          url={`${SITE_URL}${post.href}`}
          title={post.title}
          excerpt={post.excerpt}
        />
        <SocialIcons />
      </div>
    </header>
  );
}

export function ArticleHero({ post }: { post: LoadedPost }) {
  const { image } = post;
  // Portrait art (social carousels are 4:5) would lose its top and bottom to a
  // 16:9 crop, so it is shown whole instead.
  const portrait = image.height > image.width;
  return (
    <figure
      className={`ff-article__hero${portrait ? " ff-article__hero--portrait" : ""}`}
    >
      <img
        src={image.src}
        width={image.width}
        height={image.height}
        srcSet={image.srcSet}
        sizes={image.sizes}
        alt={image.alt ?? ""}
        decoding="async"
        fetchPriority="high"
      />
      {image.caption && (
        <figcaption className="ff-article__hero-caption">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function ArticleToc({ headings }: { headings: Heading[] }) {
  return (
    <nav className="ff-card ff-toc ff-article-toc" aria-label="On this page">
      <p className="ff-article-toc__heading">On this page</p>
      <ul>
        {headings.map((heading) => (
          <li key={heading.id} data-depth={heading.depth}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PrevNextLink({
  post,
  direction,
}: {
  post: LoadedPost;
  direction: "Previous" | "Next";
}) {
  const thumb = (
    <span className="ff-article__prev-next-thumb">
      <img
        src={post.image.src}
        srcSet={post.image.srcSet}
        sizes="96px"
        alt=""
        width={96}
        height={72}
        decoding="async"
        loading="lazy"
      />
    </span>
  );
  return (
    <a
      href={post.href}
      className={`ff-article__prev-next-link${
        direction === "Next" ? " ff-article__prev-next--next" : ""
      }`}
    >
      {/* Thumbnail leads on Previous and trails on Next, so the pair reads
          outward from the centre. */}
      {direction === "Previous" && thumb}
      <span className="ff-article__prev-next-body">
        <span className="ff-article__prev-next-dir">{direction}</span>
        <span className="ff-article__prev-next-title">{post.title}</span>
      </span>
      {direction === "Next" && thumb}
    </a>
  );
}

export function ArticlePrevNext({
  previous,
  next,
}: {
  previous?: LoadedPost;
  next?: LoadedPost;
}) {
  if (!previous && !next) return null;
  return (
    <nav className="ff-article__prev-next" aria-label="More articles">
      {previous && <PrevNextLink post={previous} direction="Previous" />}
      {next && <PrevNextLink post={next} direction="Next" />}
    </nav>
  );
}

export function ArticleRelated({ posts }: { posts: LoadedPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="ff-article-related ff-container">
      <h2 className="ff-band-title">Related content</h2>
      <div className="ff-news-grid">
        {posts.map((post) => (
          <NewsCard key={post.href} post={post} />
        ))}
      </div>
    </section>
  );
}
