import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: true,
  },
  allowedDevOrigins: ['192.168.124.247'],
  productionBrowserSourceMaps: true,
  // Keep Node.js native modules external (not bundled) to prevent runtime hangs
  serverExternalPackages: ['ldapjs', 'jsonwebtoken'],
  experimental: {
    turbopackSourceMaps: true,
    turbopackInputSourceMaps: true,
    turbopackRemoveUnusedExports: false,
    turbopackRemoveUnusedImports: false,
    turbopackMinify: false,
  },
};
