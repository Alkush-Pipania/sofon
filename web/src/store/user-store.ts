import { create } from "zustand";

interface UserProfile {
    id: string;
    name: string;
    email: string;
    monitors_count: number;
    is_paid_user: boolean;
}

interface UserStore {
    profile: UserProfile | null;
    setProfile: (profile: UserProfile) => void;
    clearProfile: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),
    clearProfile: () => set({ profile: null }),
}));
