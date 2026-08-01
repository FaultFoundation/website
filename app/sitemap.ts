import type { MetadataRoute } from "next";

import { authors } from "@/lib/authors";
import { getAllPosts, getAllTags } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** Routes that are hand-written pages rather than generated content. */
const STATIC_ROUTES = [
  "/",
  "/about/",
  "/news/",
  "/policies/",
  "/bylaws/",
  "/disciplinary-policy/",
  "/privacy-policy/",
  "/roadmap/",
  "/overfault-rulebook/",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  return [
    ...STATIC_ROUTES.map((route) => ({ url: `${SITE_URL}${route}` })),
    // Derived, so a new article can never be silently omitted — which is what
    // the previous hardcoded route list made easy.
    ...posts.map((post) => ({
      url: `${SITE_URL}${post.href}`,
      lastModified: post.updatedISO ?? post.dateISO,
    })),
    ...Object.values(authors).map((author) => ({ url: `${SITE_URL}${author.path}` })),
    ...getAllTags().map((tag) => ({ url: `${SITE_URL}/tag/${tag}/` })),
  ];
}
