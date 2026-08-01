/**
 * Server-rendered MDX building blocks: Figure, PullQuote, Callout.
 *
 * Kept in one file because each is a handful of lines and they are always
 * imported together by mdx-components.tsx.
 */

import type { ReactNode } from "react";

export function Figure({
  src,
  alt,
  width,
  height,
  caption,
  full = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
  /** Break out to the full page width instead of the "wide" column. */
  full?: boolean;
}) {
  return (
    <figure className={`ff-article-figure${full ? " ff-article-full" : ""}`}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        loading="lazy"
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function PullQuote({
  children,
  cite,
}: {
  children: ReactNode;
  cite?: string;
}) {
  return (
    <figure className="ff-article-quote">
      <blockquote>{children}</blockquote>
      {cite && <figcaption className="ff-article-quote__cite">{cite}</figcaption>}
    </figure>
  );
}

export function Callout({
  children,
  label,
  variant = "note",
}: {
  children: ReactNode;
  label?: string;
  variant?: "note" | "warn";
}) {
  return (
    <aside
      className={`ff-article-callout${
        variant === "warn" ? " ff-article-callout--warn" : ""
      }`}
    >
      {label && <strong className="ff-article-callout__label">{label}</strong>}
      {children}
    </aside>
  );
}
