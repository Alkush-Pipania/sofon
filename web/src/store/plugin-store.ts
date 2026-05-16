import { create } from "zustand";
import { get, put, del } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { useTeamStore } from "@/store/team-store";

export interface Plugin {
    id: string;
    type: string;
    enabled: boolean;
    config?: Record<string, string>;
    updated_at: string;
}

interface PluginListResponse {
    success: boolean;
    data: { plugins: Plugin[] };
}

interface PluginSingleResponse {
    success: boolean;
    data: Plugin;
}

interface PluginState {
    plugins: Plugin[];
    loading: boolean;
    saving: boolean;
    error: string | null;

    fetchPlugins: () => Promise<void>;
    fetchPlugin: (type: string) => Promise<Plugin | null>;
    upsertPlugin: (type: string, enabled: boolean, config: Record<string, string>) => Promise<Plugin>;
    deletePlugin: (type: string) => Promise<void>;
}

function currentTeamId(): string | null {
    return useTeamStore.getState().currentTeam?.id ?? null;
}

export const usePluginStore = create<PluginState>((set, getState) => ({
    plugins: [],
    loading: false,
    saving: false,
    error: null,

    fetchPlugins: async () => {
        const teamId = currentTeamId();
        if (!teamId) return;
        set({ loading: true, error: null });
        try {
            const res = await get<PluginListResponse>(ENDPOINTS.PLUGINS.LIST(teamId));
            set({ plugins: res.data.plugins ?? [], loading: false });
        } catch (err: unknown) {
            set({ loading: false, error: err instanceof Error ? err.message : "Failed to load plugins" });
        }
    },

    fetchPlugin: async (type: string) => {
        const teamId = currentTeamId();
        if (!teamId) return null;
        try {
            const res = await get<PluginSingleResponse>(ENDPOINTS.PLUGINS.GET(teamId, type));
            return res.data;
        } catch {
            return null;
        }
    },

    upsertPlugin: async (type: string, enabled: boolean, config: Record<string, string>) => {
        const teamId = currentTeamId();
        if (!teamId) throw new Error("No team selected");
        set({ saving: true, error: null });
        try {
            const res = await put<PluginSingleResponse>(
                ENDPOINTS.PLUGINS.UPSERT(teamId, type),
                { enabled, config },
            );
            const updated = res.data;
            set((state) => ({
                plugins: state.plugins.some((p) => p.type === type)
                    ? state.plugins.map((p) => (p.type === type ? updated : p))
                    : [...state.plugins, updated],
                saving: false,
            }));
            return updated;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to save plugin";
            set({ saving: false, error: msg });
            throw err;
        }
    },

    deletePlugin: async (type: string) => {
        const teamId = currentTeamId();
        if (!teamId) throw new Error("No team selected");
        try {
            await del(ENDPOINTS.PLUGINS.DELETE(teamId, type));
            set((state) => ({ plugins: state.plugins.filter((p) => p.type !== type) }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to delete plugin";
            set({ error: msg });
            throw err;
        }
    },
}));
