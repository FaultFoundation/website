"use client";

/**
 * In-article image gallery (embla). Used mainly by imported social posts,
 * which are 3-4 image carousels.
 *
 * Never autoplays — this sits inside body copy, and motion the reader didn't
 * ask for competes with reading.
 */

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

export type GalleryImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
};

function Arrow({ flip }: { flip?: boolean }) {
  return (
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
      focusable="false"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function Gallery({
  images,
  label = "Images from this post",
}: {
  images: GalleryImage[];
  label?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // A single image needs no carousel chrome.
  if (images.length === 1) {
    const only = images[0];
    return (
      <figure className="ff-article-figure">
        <img
          src={only.src}
          width={only.width}
          height={only.height}
          alt={only.alt}
          decoding="async"
        />
        {only.caption && <figcaption>{only.caption}</figcaption>}
      </figure>
    );
  }

  const active = images[selected];

  return (
    <figure
      className="ff-article-gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="ff-article-gallery__viewport" ref={emblaRef}>
        <div className="ff-article-gallery__slides">
          {images.map((image, index) => (
            <div
              key={image.src}
              className="ff-article-gallery__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${images.length}`}
            >
              <img
                src={image.src}
                width={image.width}
                height={image.height}
                alt={image.alt}
                decoding="async"
                loading={index === 0 ? undefined : "lazy"}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="ff-article-gallery__arrow ff-article-gallery__arrow--prev"
          aria-label="Previous image"
          onClick={scrollPrev}
          disabled={selected === 0}
        >
          <Arrow />
        </button>
        <button
          type="button"
          className="ff-article-gallery__arrow ff-article-gallery__arrow--next"
          aria-label="Next image"
          onClick={scrollNext}
          disabled={selected === images.length - 1}
        >
          <Arrow flip />
        </button>
        <p className="ff-article-gallery__counter" aria-hidden="true">
          {selected + 1} / {images.length}
        </p>
      </div>
      <div className="ff-article-gallery__dots">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            className={`ff-article-gallery__dot${
              index === selected ? " is-active" : ""
            }`}
            aria-label={`Go to image ${index + 1}`}
            aria-pressed={index === selected}
            onClick={() => emblaApi?.scrollTo(index)}
          />
        ))}
      </div>
      {active?.caption && (
        <figcaption className="ff-article-gallery__caption">
          {active.caption}
        </figcaption>
      )}
    </figure>
  );
}
