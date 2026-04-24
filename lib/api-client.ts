// Client-side helper for building API URLs that respect Next.js's basePath.
//
// Next.js auto-prefixes <Link> and router.push(), but `fetch()` is absolute
// from the origin — so `fetch("/api/chat")` from a page mounted at /pilot/
// would hit the hostname root (the hub) instead of the pilot. This helper
// reads the basePath injected via next.config.ts's `env` field.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiPath(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${BASE}${path}`;
}
