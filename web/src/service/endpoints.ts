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
        SETUP_STATUS: "/api/v1/users/setup-status",
    },

    // ── Users ─────────────────────────────────────────
    USERS: {
        ME: "/api/v1/users/get-profile",
        UPDATE_PROFILE: "/api/v1/users/profile",
        CHANGE_PASSWORD: "/api/v1/users/change-password",
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

    // ── Team ──────────────────────────────────────────
    TEAM: {
        GET: "/api/v1/team",
        UPDATE: "/api/v1/team",
        MEMBERS: "/api/v1/team/members",
        INVITATIONS: "/api/v1/team/invitations",
        INVITATION_BY_TOKEN: (token: string) => `/api/v1/team/invitations/${token}`,
        REVOKE_INVITATION: (id: string) => `/api/v1/team/invitations/${id}`,
        SET_MEMBER_ACTIVE: (id: string) => `/api/v1/team/members/${id}`,
        ACCEPT_INVITATION: "/api/v1/team/invitations/accept",
    },
} as const;
