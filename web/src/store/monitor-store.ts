import { create } from "zustand";
import { get, post, patch as patchReq, del } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { useTeamStore } from "@/store/team-store";

// ── Types ───────────────────────────────────────────
export interface Monitor {
    id: string;
    url: string;
    alert_mail: string;
    interval_sec: number;
    timeout_sec: number;
    latency_threshold_ms: number | null;
    expected_status: number | null;
    enabled: boolean;
}

interface MonitorsResponse {
    success: boolean;
    message: string;
    data: {
        team_id: string;
        limit: number;
        offset: number;
        monitors: Monitor[];
    };
}

export interface CreateMonitorRequest {
    url: string;
    alert_email: string;
    interval_sec: number;
    timeout_sec: number;
    latency_threshold_ms?: number;
    expected_status?: number;
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
    totalCount: number;
    limit: number;
    offset: number;
    loading: boolean;
    creating: boolean;
    updatingMonitorId: string | null;
    error: string | null;

    fetchMonitors: (offset?: number, limit?: number) => Promise<void>;
    createMonitor: (data: CreateMonitorRequest) => Promise<void>;
    updateMonitorStatus: (monitorID: string, enable: boolean) => Promise<void>;
    deleteMonitor: (monitorID: string) => Promise<void>;
    setOffset: (offset: number) => void;
}

function currentTeamId(): string | null {
    return useTeamStore.getState().currentTeam?.id ?? null;
}

export const useMonitorStore = create<MonitorState>((set, getState) => ({
    monitors: [],
    totalCount: 0,
    limit: 10,
    offset: 0,
    loading: false,
    creating: false,
    updatingMonitorId: null,
    error: null,

    fetchMonitors: async (offset?: number, limit?: number) => {
        const teamId = currentTeamId();
        if (!teamId) return;

        const state = getState();
        const o = offset ?? state.offset;
        const l = limit ?? state.limit;

        set({ loading: true, error: null });

        try {
            const res = await get<MonitorsResponse>(
                `${ENDPOINTS.MONITORS.LIST(teamId)}?offset=${o}&limit=${l}`,
            );

            set({
                monitors: res.data.monitors ?? [],
                totalCount: res.data.monitors?.length ?? 0,
                offset: o,
                limit: l,
                loading: false,
            });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to fetch monitors";
            set({ loading: false, error: message });
        }
    },

    createMonitor: async (data: CreateMonitorRequest) => {
        const teamId = currentTeamId();
        if (!teamId) throw new Error("No team selected");

        set({ creating: true, error: null });

        try {
            await post<CreateMonitorResponse>(ENDPOINTS.MONITORS.CREATE(teamId), data);
            set({ creating: false });
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
                totalCount: state.totalCount - 1,
                updatingMonitorId: null,
            }));
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to delete monitor";
            set({ updatingMonitorId: null, error: message });
            throw err;
        }
    },

    setOffset: (offset: number) => {
        set({ offset });
        getState().fetchMonitors(offset);
    },
}));
