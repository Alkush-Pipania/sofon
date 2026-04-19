import type { NextConfig } from "next";

// API proxying is handled at runtime by src/app/api/[...path]/route.ts
// so that API_INTERNAL_URL is never baked in at build time.
const nextConfig: NextConfig = {};

export default nextConfig;
