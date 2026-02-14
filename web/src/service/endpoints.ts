/**
 * API Endpoints
 *
 * Central registry of all backend routes.
 * Keeps URLs in one place so refactors are trivial.
 */

export const ENDPOINTS = {
    // ── Auth ──────────────────────────────────────────
    AUTH: {
        LOGIN: "/api/v1/users/login",
        REGISTER: "/api/v1/users/register",
    },

    // ── Users ─────────────────────────────────────────
    USERS: {
        ME: "/api/v1/users/me",
    },

    // ── Monitors ──────────────────────────────────────
    MONITORS: {
        LIST: "/api/v1/monitors",
        CREATE: "/api/v1/monitors",
        GET: (id: string) => `/api/v1/monitors/${id}`,
        UPDATE: (id: string) => `/api/v1/monitors/${id}`,
        DELETE: (id: string) => `/api/v1/monitors/${id}`,
    },

    // ── Incidents ─────────────────────────────────────
    INCIDENTS: {
        LIST: "/api/v1/incidents",
        GET: (id: string) => `/api/v1/incidents/${id}`,
    },
} as const;
