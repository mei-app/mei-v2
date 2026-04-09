import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow all HTTPS image sources (user-saved product images from any domain)
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
