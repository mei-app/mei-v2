import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Shopify CDN (all 13 brands use this)
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopifycdn.com" },
      // Brand-specific CDNs / image hosts
      { protocol: "https", hostname: "*.myshopify.com" },
      { protocol: "https", hostname: "fenityfashion.com" },
      { protocol: "https", hostname: "bellavenice.com" },
      { protocol: "https", hostname: "jadedldn.com" },
      { protocol: "https", hostname: "studiosevendesigns.com" },
      { protocol: "https", hostname: "withjean.com" },
      { protocol: "https", hostname: "shop437.com" },
      { protocol: "https", hostname: "us.brandymelville.com" },
      { protocol: "https", hostname: "ratboi.com" },
      { protocol: "https", hostname: "motelrocks.com" },
      { protocol: "https", hostname: "tankair.com" },
      { protocol: "https", hostname: "setactive.co" },
      { protocol: "https", hostname: "outcast-clothing.us" },
      { protocol: "https", hostname: "sashatherese.com" },
    ],
  },
};

export default nextConfig;
