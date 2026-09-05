"use client";

import { createAuthClient } from "better-auth/react";

import { COMMONS_ORIGIN } from "./commons";

/**
 * Read-mostly Better Auth client pointed at the Commons app.
 *
 * Unlike the Commons' own client this one needs an explicit baseURL — the
 * marketing site has no /api/auth of its own — and it deliberately loads no
 * plugins. Nothing here signs in, links an OAuth provider, or answers a 2FA
 * challenge; the header only reads the session and offers sign-out, and every
 * other flow is a link into the Commons. Adding a plugin here would ship its
 * client bundle to every marketing page for no benefit.
 *
 * Requires the cross-subdomain session cookie and the CORS allowlist on the
 * Commons side (lib/auth.ts advanced.crossSubDomainCookies,
 * app/api/auth/[...all]/route.ts). Without either, useSession simply resolves
 * to null and the header shows Sign In — a degraded state, not a broken one.
 */
export const authClient = createAuthClient({
  baseURL: COMMONS_ORIGIN,
  fetchOptions: { credentials: "include" },
});
