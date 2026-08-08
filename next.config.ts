import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Prisma ships a native query engine binary that Turbopack cannot bundle
  // correctly (resolves a hashed alias like `@prisma/client-<hash>` that fails
  // at runtime). Treat it as an external Node module so Next requires it
  // directly without bundling. Fixes `Cannot find module '@prisma/client-<hash>'`.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
