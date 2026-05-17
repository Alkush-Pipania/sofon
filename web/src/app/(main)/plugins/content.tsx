"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePluginStore, type Plugin } from "@/store/plugin-store";
import { useTeamStore } from "@/store/team-store";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { PLUGIN_REGISTRY } from "./registry";
export type { PluginDef } from "./registry";

// ── Status badge ──────────────────────────────────────────────────────────

function PluginStatusBadge({ plugin }: { plugin: Plugin | undefined }) {
    if (!plugin) {
        return (
            <Badge variant="outline" className="border-zinc-700 text-zinc-500 bg-transparent text-xs">
                Not configured
            </Badge>
        );
    }
    if (plugin.enabled) {
        return (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Active
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-400 text-xs">
            Disabled
        </Badge>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PluginsPage() {
    const router = useRouter();
    const currentTeam = useTeamStore((s) => s.currentTeam);
    const { plugins, loading, fetchPlugins } = usePluginStore();

    useEffect(() => {
        if (!currentTeam) return;
        fetchPlugins();
    }, [currentTeam?.id]);

    if (!currentTeam) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No team selected.
            </div>
        );
    }

    const activeCount = plugins.filter((p) => p.enabled).length;

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Plugins</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Notification integrations for your team. Alerts are dispatched through every active plugin.
                    </p>
                </div>
                {activeCount > 0 && (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs mt-1">
                        {activeCount} active
                    </Badge>
                )}
            </div>

            {/* Plugin list */}
            {loading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading plugins…
                </div>
            ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                    {PLUGIN_REGISTRY.map((def, idx) => {
                        const live = plugins.find((p) => p.type === def.type);
                        const Icon = def.icon;
                        return (
                            <div
                                key={def.type}
                                onClick={() => router.push(`/plugins/${def.type}`)}
                                className={`group flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-muted/30 ${
                                    idx !== PLUGIN_REGISTRY.length - 1 ? "border-b border-border" : ""
                                }`}
                            >
                                {/* Icon */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted border border-border">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{def.name}</p>
                                        <Badge variant="outline" className="text-[10px] font-normal border-zinc-700 text-zinc-500">
                                            {def.category}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{def.description}</p>
                                </div>

                                {/* Status */}
                                <div className="shrink-0">
                                    <PluginStatusBadge plugin={live} />
                                </div>

                                {/* Last updated */}
                                <div className="shrink-0 text-xs text-muted-foreground w-24 text-right hidden md:block">
                                    {live
                                        ? new Date(live.updated_at).toLocaleDateString(undefined, {
                                            month: "short", day: "numeric", year: "numeric",
                                        })
                                        : "—"}
                                </div>

                                {/* Arrow */}
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Info callout */}
            <div className="rounded-xl border border-border bg-muted/10 px-5 py-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How plugins work</p>
                <p>
                    When a monitor fails its health check 3 times consecutively, Sofon creates an incident and dispatches
                    alerts through every plugin that is both <span className="text-foreground font-medium">active</span> and
                    selected on that monitor. Recovery notifications are sent automatically when the monitor comes back online.
                </p>
            </div>
        </div>
    );
}
