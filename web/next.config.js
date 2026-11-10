/** @type {import('next').NextConfig} */

// The browser only calls /api/... on this site; this rewrite forwards it to
// FastAPI, so the backend needs no CORS setup.
// - development: the local api (http://localhost:8000), or API_URL if set
//   (Docker Compose sets it to http://api:8000).
// - production: API_URL must be the backend Vercel project's URL.
const isDev = process.env.NODE_ENV !== "production";
const apiUrl = (process.env.API_URL || (isDev ? "http://localhost:8000" : "")).replace(/\/+$/, "");

if (!apiUrl) {
  throw new Error(
    "API_URL is not set. In production it must be the backend project's URL, e.g. https://cite-api.vercel.app",
  );
}

const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
