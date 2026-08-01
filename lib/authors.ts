/**
 * Article authors. The key is what goes in an article's `author:` frontmatter
 * field; `path` is the archive route that already exists for that person.
 */

export type Author = {
  name: string;
  path: string;
  avatar?: string;
};

export const authors: Record<string, Author> = {
  "oscar-labit": {
    name: "Oscar Labit",
    path: "/author/admin_saivw2jq/",
    avatar:
      "https://secure.gravatar.com/avatar/7f1c7aec225a2d2b181385551bbea45e1510b8025f9bac9ffe344864fd1f79f3?s=500&d=mm&r=g",
  },
};

export const DEFAULT_AUTHOR_KEY = "oscar-labit";

export function getAuthor(key: string): Author {
  const found = authors[key];
  if (!found) {
    throw new Error(
      `Unknown author "${key}". Add it to lib/authors.ts, or fix the article's author: field.`,
    );
  }
  return found;
}
