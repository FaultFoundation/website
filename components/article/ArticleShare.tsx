"use client";

/**
 * A single share control.
 *
 * Uses the Web Share API so the reader gets their own OS share sheet — every
 * destination they actually use, rather than the two or three networks we
 * could guess at. Where that API does not exist (most desktop browsers) it
 * falls back to copying the link, and says so.
 */

import { useEffect, useState } from "react";

export function ArticleShare({
  url,
  title,
  excerpt,
}: {
  url: string;
  title: string;
  excerpt?: string;
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // navigator.share only exists in the browser, and only over HTTPS — decide
  // after mount so the server and client markup agree.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const onClick = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, text: excerpt, url });
        return;
      } catch {
        // Dismissing the share sheet rejects. That is not an error worth
        // reporting, and it should not silently fall through to a copy.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied or insecure context; nothing useful left to try.
    }
  };

  const label = canShare ? "Share this article" : "Copy link to this article";

  return (
    <div className="ff-article-share">
      <button
        type="button"
        className="ff-article-share__button"
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="m16 6-4-4-4 4" />
            <path d="M12 2v13" />
          </svg>
        )}
      </button>
      {/* Announced to screen readers without occupying layout — a visible
          status string here would shove the icon row sideways on click. */}
      <span className="ff-sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
