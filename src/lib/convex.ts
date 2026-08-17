/**
 * Resolve the Convex backend URL for the current environment.
 *
 * In the Freebuff preview, Vite is served on a proxied host like
 * `5173-<workspace>.daytonaproxy01.net` while the local Convex backend runs on
 * port 3210 in the same sandbox — the browser can only reach it through the
 * sibling proxy `3210-<workspace>.daytonaproxy01.net`. Detect that host shape
 * and derive the URL at runtime so auth and storage work in the preview without
 * any env-file juggling. Everywhere else (localhost, production deploy) the
 * standard VITE_CONVEX_URL env var is used.
 */
export function resolveConvexUrl(): string | undefined {
  const hostname = window.location.hostname;
  if (hostname.startsWith("5173-")) {
    return `https://3210-${hostname.slice(5)}`;
  }
  return import.meta.env.VITE_CONVEX_URL as string | undefined;
}

/** Origin of the Convex backend the browser can reach, for rewriting URLs. */
export function getConvexOrigin(): string {
  const url = resolveConvexUrl();
  if (!url) return window.location.origin;
  try {
    return new URL(url).origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * The local Convex backend builds storage URLs from its own sandbox origin
 * (e.g. `http://127.0.0.1:3210`), which the browser cannot reach. Rewrite those
 * URLs to an origin the browser actually uses:
 *  - sameOrigin (uploads): the app's own origin — Vite dev-proxies /api/storage
 *    to the Convex backend, so the upload is same-origin and cannot hit CORS or
 *    proxy issues.
 *  - otherwise: the backend origin the client already talks to (for viewing
 *    stored files).
 * URLs that are already reachable (e.g. a real cloud deployment) pass through
 * untouched.
 */
export function rewriteConvexUrl(raw: string, opts?: { sameOrigin?: boolean }): string {
  try {
    const url = new URL(raw, window.location.origin);
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.origin)) {
      const target = opts?.sameOrigin ? window.location.origin : getConvexOrigin();
      url.protocol = new URL(target).protocol;
      url.host = new URL(target).host;
    }
    return url.toString();
  } catch {
    return raw;
  }
}
