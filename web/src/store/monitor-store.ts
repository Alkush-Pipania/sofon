import { create } from "zustand";
import { get, post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";

// ── Types ───────────────────────────────────────────
export interface Monitor {
    id: string;
    url: string;
    alert_mail: string;
    interval_sec: number;
    timeout_sec: number;
    latency_threshold_ms: number;
    expected_status: number;
    enabled: boolean;
}

interface MonitorsResponse {
    success: boolean;
    message: string;
    data: {
        user_id: string;
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
    latency_threshold_ms: number;
    expected_status: number;
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
    error: string | null;

    fetchMonitors: (offset?: number, limit?: number) => Promise<void>;
    createMonitor: (data: CreateMonitorRequest) => Promise<void>;
    setOffset: (offset: number) => void;
}

export const useMonitorStore = create<MonitorState>((set, getState) => ({
    monitors: [],
    totalCount: 0,
    limit: 10,
    offset: 0,
    loading: false,
    creating: false,
    error: null,

    fetchMonitors: async (offset?: number, limit?: number) => {
        const state = getState();
        const o = offset ?? state.offset;
        const l = limit ?? state.limit;

        set({ loading: true, error: null });

        try {
            const res = await get<MonitorsResponse>(
                `${ENDPOINTS.MONITORS.LIST}?offset=${o}&limit=${l}`,
            );

            set({
                monitors: res.data.monitors ?? [],
                totalCount: res.data.monitors?.length ?? 0, // backend doesn't return total yet, use array length
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
        set({ creating: true, error: null });

        try {
            await post<CreateMonitorResponse>(ENDPOINTS.MONITORS.CREATE, data);
            set({ creating: false });
            // Refresh the list
            await getState().fetchMonitors();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to create monitor";
            set({ creating: false, error: message });
            throw err; // re-throw so the dialog can show the error
        }
    },

    setOffset: (offset: number) => {
        set({ offset });
        getState().fetchMonitors(offset);
    },
}));
