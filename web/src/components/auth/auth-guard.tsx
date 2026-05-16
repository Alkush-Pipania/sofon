"use client";

// The primary auth gate is the Edge middleware (src/middleware.ts).
// This component's only job is to fetch the profile on mount, seed the
// team store, and hold the UI until that's done — preventing a flash
// of the sidebar with no team data.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore, get } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { useTeamStore } from "@/store/team-store";
import { useUserStore } from "@/store/user-store";

interface ProfileResponse {
    success: boolean;
    data: {
        id: string;
        name: string;
        email: string;
        monitors_count: number;
        is_paid_user: boolean;
        teams: { id: string; name: string }[];
    };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const seedTeams = useTeamStore((s) => s.seedTeams);
    const setProfile = useUserStore((s) => s.setProfile);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Middleware already blocked unauthenticated access, but if the token
        // has expired since the cookie was set, the API call will 401 and the
        // global axios interceptor will clear the token + redirect to /signin.
        get<ProfileResponse>(ENDPOINTS.USERS.ME)
            .then((res) => {
                seedTeams(res.data.teams ?? []);
                setProfile({
                    id: res.data.id,
                    name: res.data.name,
                    email: res.data.email,
                    monitors_count: res.data.monitors_count,
                    is_paid_user: res.data.is_paid_user,
                });
                setReady(true);
            })
            .catch(() => {
                // Token expired / invalid — clear both stores and let the
                // 401 interceptor in api.ts handle the redirect to /signin.
                tokenStore.clear();
                router.replace("/signin");
            });
    }, [router, seedTeams]);

    if (!ready) return null;

    return <>{children}</>;
}
