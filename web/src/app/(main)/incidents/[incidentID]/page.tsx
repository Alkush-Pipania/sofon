"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { useTeamStore } from "@/store/team-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertCircle, AlertTriangle, ArrowLeft, Clock, ExternalLink,
    Loader2, Mail, MailX, Shield, Zap,
} from "lucide-react";

interface LatestAlert {
    status?: string;
    email?: string;
    sent_at?: string | null;
}

interface Incident {
    id: string;
    monitor_id: string;
    monitor_url: string;
    start_time: string;
    end_time?: string | null;
    alerted: boolean;
    http_status: number;
    latency_ms: number;
    created_at: string;
    is_active: boolean;
    duration_sec: number;
    reason?: string;
    latest_alert?: LatestAlert | null;
}

interface IncidentDetailResponse {
    success: boolean;
    data: Incident;
}

function formatDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatUrl(raw: string) {
    try {
        const u = new URL(raw);
        return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
        return raw;
    }
}

function httpStatusColor(code: number) {
    if (!code || code === 0) return { badge: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400", label: "No response" };
    if (code >= 500) return { badge: "border-red-500/30 bg-red-500/10 text-red-500", label: "Server error" };
    if (code >= 400) return { badge: "border-orange-500/30 bg-orange-500/10 text-orange-500", label: "Client error" };
    if (code >= 300) return { badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500", label: "Redirect" };
    return { badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500", label: "OK" };
}

function latencyColor(ms: number): string {
    if (ms === 0) return "text-muted-foreground";
    if (ms < 500) return "text-emerald-500";
    if (ms < 2000) return "text-yellow-500";
    return "text-red-500";
}

function StatCard({ icon: Icon, label, value, sub, iconClass }: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    iconClass?: string;
}) {
    return (
        <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className={`h-4 w-4 ${iconClass ?? "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-semibold leading-tight">{value}</p>
                {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

export default function IncidentDetailPage() {
    const params = useParams<{ incidentID: string }>();
    const incidentID = String(params.incidentID || "");
    const currentTeam = useTeamStore((s) => s.currentTeam);

    const [incident, setIncident] = useState<Incident | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            if (!currentTeam || !incidentID) return;
            setLoading(true);
            setError(null);
            try {
                const res = await get<IncidentDetailResponse>(ENDPOINTS.INCIDENTS.GET(currentTeam.id, incidentID));
                setIncident(res.data);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to load incident");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [incidentID, currentTeam?.id]);

    if (loading) {
        return (
            <div className="flex h-56 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading incident…
            </div>
        );
    }

    if (error || !incident) {
        return (
            <div className="space-y-4">
                <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
                </Link>
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">{error || "Incident not found"}</p>
                </div>
            </div>
        );
    }

    const { badge: httpBadge, label: httpLabel } = httpStatusColor(incident.http_status);
    const alertStatus = incident.latest_alert?.status;
    const hasAlert = !!alertStatus && alertStatus !== "not_sent";

    return (
        <div className="space-y-6">
            {/* Back */}
            <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to incidents
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{formatUrl(incident.monitor_url)}</h1>
                        <a
                            href={incident.monitor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                        Incident {incident.id.slice(0, 8).toUpperCase()}
                    </p>
                </div>
                {incident.is_active ? (
                    <Badge variant="outline" className="gap-1.5 border-red-500/30 bg-red-500/10 text-red-500 text-sm px-3 py-1">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        Active
                    </Badge>
                ) : (
                    <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-sm px-3 py-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Resolved
                    </Badge>
                )}
            </div>

            {/* Trigger reason */}
            {incident.reason && (
                <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <div>
                        <p className="text-xs font-medium text-orange-500">Trigger reason</p>
                        <p className="mt-0.5 text-sm text-foreground">{incident.reason}</p>
                    </div>
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                    icon={Clock}
                    label="Duration"
                    value={formatDuration(incident.duration_sec)}
                    sub={incident.is_active ? "still ongoing" : "total downtime"}
                    iconClass="text-muted-foreground"
                />
                <StatCard
                    icon={Shield}
                    label="HTTP Status"
                    value={incident.http_status ? String(incident.http_status) : "—"}
                    sub={httpLabel}
                    iconClass={incident.http_status >= 500 || !incident.http_status ? "text-red-500" : incident.http_status >= 400 ? "text-orange-500" : "text-muted-foreground"}
                />
                <StatCard
                    icon={Zap}
                    label="Latency at detection"
                    value={incident.latency_ms > 0 ? `${incident.latency_ms} ms` : "—"}
                    sub={incident.latency_ms > 2000 ? "very slow" : incident.latency_ms > 500 ? "slow" : incident.latency_ms > 0 ? "fast" : undefined}
                    iconClass={latencyColor(incident.latency_ms)}
                />
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3.5">
                    <p className="text-sm font-semibold">Timeline</p>
                </div>
                <div className="px-5 divide-y divide-border">
                    <InfoRow
                        label="Detected at"
                        value={new Date(incident.start_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })}
                    />
                    <InfoRow
                        label="Resolved at"
                        value={incident.end_time
                            ? new Date(incident.end_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
                            : <span className="text-red-500">Ongoing</span>
                        }
                    />
                    <InfoRow label="Total duration" value={formatDuration(incident.duration_sec)} />
                    <InfoRow
                        label="HTTP status"
                        value={
                            <Badge variant="outline" className={`font-mono ${httpBadge}`}>
                                {incident.http_status || "no response"}
                            </Badge>
                        }
                    />
                    <InfoRow
                        label="Latency"
                        value={<span className={latencyColor(incident.latency_ms)}>{incident.latency_ms > 0 ? `${incident.latency_ms} ms` : "—"}</span>}
                    />
                </div>
            </div>

            {/* Alert delivery */}
            <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
                    <p className="text-sm font-semibold">Alert delivery</p>
                    {hasAlert ? (
                        alertStatus === "sent"
                            ? <span className="flex items-center gap-1.5 text-xs text-emerald-500"><Mail className="h-3.5 w-3.5" /> Sent</span>
                            : <span className="flex items-center gap-1.5 text-xs text-red-500"><MailX className="h-3.5 w-3.5" /> Failed</span>
                    ) : (
                        <span className="text-xs text-muted-foreground">Not sent</span>
                    )}
                </div>
                <div className="px-5 divide-y divide-border">
                    <InfoRow label="Recipient" value={incident.latest_alert?.email || <span className="text-muted-foreground">—</span>} />
                    <InfoRow
                        label="Sent at"
                        value={incident.latest_alert?.sent_at
                            ? new Date(incident.latest_alert.sent_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
                            : <span className="text-muted-foreground">—</span>
                        }
                    />
                    <InfoRow
                        label="Alert triggered"
                        value={incident.alerted
                            ? <span className="text-emerald-500">Yes</span>
                            : <span className="text-muted-foreground">No</span>
                        }
                    />
                </div>
            </div>

            {/* Meta */}
            <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3.5">
                    <p className="text-sm font-semibold">Details</p>
                </div>
                <div className="px-5 divide-y divide-border">
                    <InfoRow
                        label="Monitor URL"
                        value={
                            <a href={incident.monitor_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-mono hover:underline">
                                {incident.monitor_url}
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        }
                    />
                    <InfoRow
                        label="Record created"
                        value={new Date(incident.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    />
                </div>
            </div>
        </div>
    );
}
