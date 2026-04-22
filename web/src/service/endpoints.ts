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

    // ── Teams ─────────────────────────────────────────
    TEAMS: {
        LIST: "/api/v1/teams",
        CREATE: "/api/v1/teams",
        GET: (teamId: string) => `/api/v1/teams/${teamId}`,
        UPDATE: (teamId: string) => `/api/v1/teams/${teamId}`,
        MEMBERS: (teamId: string) => `/api/v1/teams/${teamId}/members`,
        SET_MEMBER_ACTIVE: (teamId: string, userId: string) => `/api/v1/teams/${teamId}/members/${userId}`,
        INVITATIONS: (teamId: string) => `/api/v1/teams/${teamId}/invitations`,
        REVOKE_INVITATION: (teamId: string, invId: string) => `/api/v1/teams/${teamId}/invitations/${invId}`,
        INVITATION_BY_TOKEN: (token: string) => `/api/v1/teams/invitations/${token}`,
        ACCEPT_INVITATION: "/api/v1/teams/invitations/accept",
    },

    // ── Monitors (team-scoped) ─────────────────────────
    MONITORS: {
        LIST: (teamId: string) => `/api/v1/teams/${teamId}/monitors`,
        CREATE: (teamId: string) => `/api/v1/teams/${teamId}/monitors`,
        GET: (teamId: string, id: string) => `/api/v1/teams/${teamId}/monitors/${id}`,
        UPDATE: (teamId: string, id: string) => `/api/v1/teams/${teamId}/monitors/${id}`,
        DELETE: (teamId: string, id: string) => `/api/v1/teams/${teamId}/monitors/${id}`,
    },

    // ── Incidents (team-scoped) ────────────────────────
    INCIDENTS: {
        LIST: (teamId: string) => `/api/v1/teams/${teamId}/incidents`,
        GET: (teamId: string, id: string) => `/api/v1/teams/${teamId}/incidents/${id}`,
    },
} as const;
