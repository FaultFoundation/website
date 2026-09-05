/**
 * The Commons app (separate repo, deployed to commons.fault.foundation).
 *
 * This site is a static export with no backend of its own, so every Commons
 * destination is an absolute URL and the header's session check is a
 * cross-origin fetch. Centralised here so a domain change is one edit.
 */
export const COMMONS_ORIGIN =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://commons.fault.foundation";

export const commonsUrl = (path: string) => `${COMMONS_ORIGIN}${path}`;

export const COMMONS_HOME = commonsUrl("/");
export const COMMONS_LOGIN = commonsUrl("/login/");
export const COMMONS_DASHBOARD = commonsUrl("/home/");
export const COMMONS_ACCOUNT = commonsUrl("/account/");
