/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@smartbimbel/shared", "@smartbimbel/ui"],
  reactStrictMode: true,
  // Required in Next 14 for instrumentation.ts (Sentry server/edge init,
  // Task 8.5) to actually be picked up - stable/default from Next 15 on.
  experimental: { instrumentationHook: true },
  // Same pattern as apps/web: proxy /api/* to the Nest API so a single
  // public tunnel can reach both (admin never needs its own API URL).
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:4000/api/:path*" }];
  },
};

module.exports = nextConfig;
