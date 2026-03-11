import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qsupskdnaqzmoksxdmue.supabase.co',
      },
    ],
  },
};

export default nextConfig;
