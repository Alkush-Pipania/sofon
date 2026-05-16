import { create } from "zustand";
import { get, post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";

export interface Team {
    id: string;
    name: string;
    created_at?: string;
}

interface TeamsResponse {
    success: boolean;
    data: Team[];
}

interface CreateTeamResponse {
    success: boolean;
    data: Team;
}

const CURRENT_TEAM_KEY = "sofon_current_team_id";

interface TeamStore {
    teams: Team[];
    currentTeam: Team | null;
    loading: boolean;
    // Seed teams directly from the profile response (no extra API call)
    seedTeams: (teams: Team[]) => void;
    setCurrentTeam: (team: Team) => void;
    fetchTeams: () => Promise<void>;
    createTeam: (name: string) => Promise<Team>;
}

export const useTeamStore = create<TeamStore>((set, getState) => ({
    teams: [],
    currentTeam: null,
    loading: false,

    seedTeams: (teams: Team[]) => {
        const savedId = localStorage.getItem(CURRENT_TEAM_KEY);
        const saved = teams.find((t) => t.id === savedId);
        const current = saved ?? teams[0] ?? null;
        if (current) {
            localStorage.setItem(CURRENT_TEAM_KEY, current.id);
        }
        set({ teams, currentTeam: current });
    },

    setCurrentTeam: (team: Team) => {
        localStorage.setItem(CURRENT_TEAM_KEY, team.id);
        set({ currentTeam: team });
    },

    fetchTeams: async () => {
        set({ loading: true });
        try {
            const res = await get<TeamsResponse>(ENDPOINTS.TEAMS.LIST);
            const teams = res.data ?? [];

            const savedId = localStorage.getItem(CURRENT_TEAM_KEY);
            const saved = teams.find((t) => t.id === savedId);
            const current = saved ?? teams[0] ?? null;

            if (current) {
                localStorage.setItem(CURRENT_TEAM_KEY, current.id);
            }

            set({ teams, currentTeam: current, loading: false });
        } catch {
            set({ loading: false });
        }
    },

    createTeam: async (name: string) => {
        const res = await post<CreateTeamResponse>(ENDPOINTS.TEAMS.CREATE, { name });
        const team = res.data;
        set((state) => ({
            teams: [...state.teams, team],
            currentTeam: state.currentTeam ?? team,
        }));
        localStorage.setItem(CURRENT_TEAM_KEY, team.id);
        // Refresh full team list from server to get created_at etc.
        getState().fetchTeams();
        return team;
    },
}));
