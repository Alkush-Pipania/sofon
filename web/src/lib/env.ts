export const env = {
    // Empty string = relative URL (same origin). Next.js rewrites /api/* → api:8080 at runtime.
    // Set NEXT_PUBLIC_API_URL only for local dev pointing at a separate API host.
    API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
} as const;
