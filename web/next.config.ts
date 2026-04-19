import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async rewrites() {
        // API_INTERNAL_URL is a runtime (non-public) env var — never baked into the image.
        // In Docker Compose the web container sets this to http://api:8080.
        // Locally it falls back to localhost:8080.
        const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:8080";
        return [
            {
                source: "/api/:path*",
                destination: `${apiBase}/api/:path*`,
            },
            {
                source: "/health",
                destination: `${apiBase}/health`,
            },
        ];
    },
};

export default nextConfig;
