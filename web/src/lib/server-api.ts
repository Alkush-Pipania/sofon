// Server-only. Used by SSR and the /api/[...path] proxy to reach the API
// over the internal Docker network. Must NOT be imported from client code.
//
// Lazy (function, not const) so `next build` doesn't throw when API_INTERNAL_URL
// is absent at build time — it's a runtime requirement, not a build-time one.
export function serverApiBase(): string {
    const url = process.env.API_INTERNAL_URL;
    if (!url) {
        throw new Error(
            "API_INTERNAL_URL is not set. The web container needs this to reach the API " +
                "(e.g. http://api:8080 in docker-compose).",
        );
    }
    return url;
}
