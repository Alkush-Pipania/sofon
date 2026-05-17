import { create } from "zustand";
import { get, post, patch as patchReq, del } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { useTeamStore } from "@/store/team-store";

// ── Types ───────────────────────────────────────────
export interface Monitor {
    id: string;
    url: string;
    interval_sec: number;
    timeout_sec: number;
    latency_threshold_ms: number | null;
    expected_status: number | null;
    enabled: boolean;
    is_down: boolean;
    notification_channels: string[];
}

interface MonitorsResponse {
    success: boolean;
    message: string;
    data: {
        limit: number;
        has_more: boolean;
        next_cursor: string | null;
        monitors: Monitor[];
    };
}

export interface CreateMonitorRequest {
    url: string;
    interval_sec: number;
    timeout_sec: number;
    latency_threshold_ms?: number;
    expected_status?: number;
    notification_channels: string[];
}

interface CreateMonitorResponse {
    success: boolean;
    message: string;
    data: {
        monitor_id: string;
    };
}

// ── Store ───────────────────────────────────────────
interface MonitorState {
    monitors: Monitor[];
    limit: number;
    hasMore: boolean;
    hasPrev: boolean;
    nextCursor: string | null;
    pageStack: string[];
    loading: boolean;
    creating: boolean;
    updatingMonitorId: string | null;
    error: string | null;

    fetchMonitors: (cursor?: string) => Promise<void>;
    createMonitor: (data: CreateMonitorRequest) => Promise<void>;
    updateMonitorStatus: (monitorID: string, enable: boolean) => Promise<void>;
    deleteMonitor: (monitorID: string) => Promise<void>;
    goNext: () => void;
    goPrev: () => void;
}

function currentTeamId(): string | null {
    return useTeamStore.getState().currentTeam?.id ?? null;
}

export const useMonitorStore = create<MonitorState>((set, getState) => ({
    monitors: [],
    limit: 10,
    hasMore: false,
    hasPrev: false,
    nextCursor: null,
    pageStack: [],
    loading: false,
    creating: false,
    updatingMonitorId: null,
    error: null,

    fetchMonitors: async (cursor?: string) => {
        const teamId = currentTeamId();
        if (!teamId) return;

        const { limit } = getState();
        set({ loading: true, error: null });

        try {
            const url = cursor
                ? `${ENDPOINTS.MONITORS.LIST(teamId)}?limit=${limit}&cursor=${cursor}`
                : `${ENDPOINTS.MONITORS.LIST(teamId)}?limit=${limit}`;

            const res = await get<MonitorsResponse>(url);

            set({
                monitors: res.data.monitors ?? [],
                hasMore: res.data.has_more ?? false,
                nextCursor: res.data.next_cursor ?? null,
                loading: false,
            });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to fetch monitors";
            set({ loading: false, error: message });
        }
    },

    goNext: () => {
        const { nextCursor, pageStack, fetchMonitors } = getState();
        if (!nextCursor) return;
        set((state) => ({
            pageStack: [...state.pageStack, nextCursor],
            hasPrev: true,
        }));
        fetchMonitors(nextCursor);
    },

    goPrev: () => {
        const { pageStack, fetchMonitors } = getState();
        if (pageStack.length === 0) return;
        const newStack = pageStack.slice(0, -1);
        const prevCursor = newStack[newStack.length - 1];
        set({ pageStack: newStack, hasPrev: newStack.length > 0 });
        fetchMonitors(prevCursor);
    },

    createMonitor: async (data: CreateMonitorRequest) => {
        const teamId = currentTeamId();
        if (!teamId) throw new Error("No team selected");

        set({ creating: true, error: null });

        try {
            await post<CreateMonitorResponse>(ENDPOINTS.MONITORS.CREATE(teamId), data);
            // Reset to first page after creating so the new monitor appears
            set({ creating: false, pageStack: [], hasPrev: false });
            await getState().fetchMonitors();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to create monitor";
            set({ creating: false, error: message });
            throw err;
        }
    },

    updateMonitorStatus: async (monitorID: string, enable: boolean) => {
        const teamId = currentTeamId();
        if (!teamId) throw new Error("No team selected");

        set({ updatingMonitorId: monitorID, error: null });

        try {
            await patchReq<{ success: boolean; message: string; data: string }>(
                ENDPOINTS.MONITORS.UPDATE(teamId, monitorID),
                { enable },
            );

            set((state) => ({
                monitors: state.monitors.map((m) =>
                    m.id === monitorID ? { ...m, enabled: enable } : m,
                ),
                updatingMonitorId: null,
            }));
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to update monitor status";
            set({ updatingMonitorId: null, error: message });
            throw err;
        }
    },

    deleteMonitor: async (monitorID: string) => {
        const teamId = currentTeamId();
        if (!teamId) throw new Error("No team selected");

        set({ updatingMonitorId: monitorID, error: null });

        try {
            await del<{ success: boolean; message: string }>(
                ENDPOINTS.MONITORS.DELETE(teamId, monitorID),
            );

            set((state) => ({
                monitors: state.monitors.filter((m) => m.id !== monitorID),
                updatingMonitorId: null,
            }));
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to delete monitor";
            set({ updatingMonitorId: null, error: message });
            throw err;
        }
    },

}));
