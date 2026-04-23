#!/usr/bin/env node
// Tiny static file server for the exported Expo web bundle.
// SPA fallback — unknown routes serve index.html so expo-router "single" output
// handles client-side routing correctly.
//
// Env:
//   PORT (default 3002)
//   HOST (default 127.0.0.1)
//   DIST (default ./dist)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(HERE, "..", process.env.DIST ?? "dist");
const PORT = Number(process.env.PORT ?? 3002);
const HOST = process.env.HOST ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFile(reqPath) {
  let rel = decodeURIComponent(reqPath.split("?")[0]);
  if (rel.includes("..")) return join(DIST, "index.html"); // defuse traversal
  if (rel.endsWith("/")) rel += "index.html";
  let abs = join(DIST, rel);
  try {
    const s = await stat(abs);
    if (s.isDirectory()) abs = join(abs, "index.html");
    await stat(abs);
    return abs;
  } catch {
    return join(DIST, "index.html"); // SPA fallback
  }
}

createServer(async (req, res) => {
  try {
    const filePath = await resolveFile(req.url ?? "/");
    const body = await readFile(filePath);
    const type = MIME[extname(filePath)] ?? "application/octet-stream";
    res.setHeader("content-type", type);
    // No caching for index.html so new deploys are picked up immediately.
    if (filePath.endsWith("index.html")) {
      res.setHeader("cache-control", "no-cache");
    } else {
      res.setHeader("cache-control", "public, max-age=3600");
    }
    res.end(body);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("internal error");
  }
}).listen(PORT, HOST, () => {
  console.log(`mercury web → http://${HOST}:${PORT}  (serving ${DIST})`);
});
