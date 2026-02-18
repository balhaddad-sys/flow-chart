import type { NextConfig } from "next";

// Security headers are applied in middleware.ts to avoid duplication.
// next.config.ts only handles caching headers for static assets.

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/icons/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
