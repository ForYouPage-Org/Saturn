import type { NextConfig } from "next";

// Tailscale Funnel mounts mercury-pilot at /pilot on the shared
// marxs-imac.tail876aa7.ts.net hostname. The tailscale_serve.sh script
// proxies with a target URL that preserves the /pilot prefix, so Next.js
// sees /pilot/* on the wire and basePath matches.
//
// Override for local dev (no tailscale) by setting MERCURY_BASE_PATH=""
// so the app is reachable at http://localhost:3002/.
const BASE_PATH =
  process.env.MERCURY_BASE_PATH !== undefined ? process.env.MERCURY_BASE_PATH : "/pilot";

const config: NextConfig = {
  basePath: BASE_PATH || undefined,
  // Keep serverExternalPackages for better-sqlite3 — it's a native module
  // and Next.js shouldn't bundle it.
  serverExternalPackages: ["better-sqlite3"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default config;
