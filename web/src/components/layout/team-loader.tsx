"use client";

import { useEffect } from "react";
import { useTeamStore } from "@/store/team-store";

export function TeamLoader() {
    const fetchTeams = useTeamStore((s) => s.fetchTeams);
    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);
    return null;
}
