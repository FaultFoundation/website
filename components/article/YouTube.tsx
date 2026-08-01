"use client";

/**
 * Click-to-load YouTube embed.
 *
 * Nothing is requested from Google until the reader clicks: the poster comes
 * from i.ytimg.com only after interaction is impossible to avoid, and the
 * iframe points at youtube-nocookie.com. Shipping a tracking iframe by default
 * on a site whose articles are titled "Discord and Sharing Personal
 * Information" would undercut the writing.
 */

import { useState } from "react";

export function YouTube({
  id,
  title,
  caption,
}: {
  id: string;
  title: string;
  caption?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="ff-article-embed">
      <div className="ff-article-embed__frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="ff-article-embed__facade"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${title}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              width={480}
              height={360}
              decoding="async"
              loading="lazy"
            />
            <span className="ff-article-embed__play">
              <span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="ff-article-embed__note">
        {caption ?? (
          <>
            {title} — loads from YouTube only when you press play.
          </>
        )}
      </figcaption>
    </figure>
  );
}
