import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Compress responses with gzip to reduce transfer size for JSON/JS/CSS.
  compress: true,
};

export default nextConfig;
