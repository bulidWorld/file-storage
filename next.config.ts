import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: true,
  },
  allowedDevOrigins: ['192.168.124.247'],
  productionBrowserSourceMaps: true,
};

export default nextConfig;
