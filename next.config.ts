import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: true,
  },
  // Allow cross-origin requests from the internal network
  allowedDevOrigins: ['192.168.124.247'],
};

export default nextConfig;
