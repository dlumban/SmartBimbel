/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@smartbimbel/shared", "@smartbimbel/ui"],
  reactStrictMode: true,
  // Required in Next 14 for instrumentation.ts (Sentry server/edge init,
  // Task 8.5) to actually be picked up - stable/default from Next 15 on.
  experimental: { instrumentationHook: true },
  // Proxies /api/* to the local API so a single public tunnel (this app)
  // is enough to reach both - the API never needs its own public URL.
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:4000/api/:path*" }];
  },
};

module.exports = nextConfig;
