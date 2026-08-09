import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Treat Prisma's generated client as a server external package so Turbopack
  // does not try to bundle/resolve the hashed intermediate module
  // (e.g. "@prisma/client-<hash>") it cannot find at runtime.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
