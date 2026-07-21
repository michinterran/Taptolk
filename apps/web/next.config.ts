import { resolve } from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: "/(.*)",
      },
    ];
  },
  async redirects() {
    return [
      {
        destination: "/:locale/admin/login",
        permanent: false,
        source: "/:locale(ko|en)/admin/platform/login",
      },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@taptolk/config", "@taptolk/observability", "@taptolk/ui"],
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
  typedRoutes: true,
};

export default nextConfig;
