"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { useTeamStore } from "@/store/team-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertCircle, ChevronLeft, ChevronRight, Clock, ExternalLink,
    Loader2, RefreshCw, Search, Zap, Mail, MailX,
} from "lucide-react";

type IncidentStatus = "all" | "active" | "resolved";

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

interface IncidentListPayload {
    limit: number;
    has_more: boolean;
    next_cursor?: string | null;
    incidents: Incident[];
}

interface IncidentListResponse {
    success: boolean;
    data: IncidentListPayload;
}

function formatDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatRelative(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function formatUrl(raw: string) {
    try {
        const u = new URL(raw);
        return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
        return raw;
    }
}

function httpStatusColor(code: number): string {
    if (!code || code === 0) return "border-zinc-500/30 bg-zinc-500/10 text-zinc-400";
    if (code >= 500) return "border-red-500/30 bg-red-500/10 text-red-500";
    if (code >= 400) return "border-orange-500/30 bg-orange-500/10 text-orange-500";
    if (code >= 300) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-500";
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
}

function AlertChip({ alert }: { alert?: LatestAlert | null }) {
    if (!alert?.status || alert.status === "not_sent") {
        return <span className="text-xs text-muted-foreground">—</span>;
    }
    if (alert.status === "sent") {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                <Mail className="h-3 w-3" /> sent
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-red-500">
            <MailX className="h-3 w-3" /> failed
        </span>
    );
}

const STATUS_TABS: { label: string; value: IncidentStatus }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Resolved", value: "resolved" },
];

export default function IncidentsPage() {
    const currentTeam = useTeamStore((s) => s.currentTeam);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [status, setStatus] = useState<IncidentStatus>("all");
    const [query, setQuery] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [cursor, setCursor] = useState<string | null>(null);
    const [history, setHistory] = useState<string[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const fetch = async (cursorValue: string | null) => {
        if (!currentTeam) return;
        setLoading(true);
        setError(null);
        try {
            const p = new URLSearchParams();
            p.set("limit", "20");
            p.set("status", status);
            if (query.trim()) p.set("q", query.trim());
            if (fromDate) p.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
            if (toDate) p.set("to", new Date(`${toDate}T23:59:59`).toISOString());
            if (cursorValue) p.set("cursor", cursorValue);

            const res = await get<IncidentListResponse>(
                `${ENDPOINTS.INCIDENTS.LIST(currentTeam.id)}?${p.toString()}`
            );
            setIncidents(res.data.incidents ?? []);
            setHasMore(res.data.has_more ?? false);
            setNextCursor(res.data.next_cursor ?? null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to fetch incidents");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(cursor); }, [cursor, currentTeam?.id]);

    const activeCount = useMemo(() => incidents.filter((i) => i.is_active).length, [incidents]);

    const onApply = () => { setCursor(null); setHistory([]); fetch(null); };
    const onClear = () => { setQuery(""); setFromDate(""); setToDate(""); setStatus("all"); setCursor(null); setHistory([]); };
    const onNext = () => { if (!nextCursor) return; setHistory((h) => [...h, cursor ?? ""]); setCursor(nextCursor); };
    const onPrev = () => {
        setHistory((h) => {
            const copy = [...h];
            const prev = copy.pop() ?? "";
            setCursor(prev === "" ? null : prev);
            return copy;
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
                    <p className="text-sm text-muted-foreground">Outages detected across your monitored endpoints.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetch(cursor)} disabled={loading} className="gap-1.5">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
                {/* Status pills */}
                <div className="flex rounded-lg border border-border p-0.5 gap-0.5">
                    {STATUS_TABS.map((t) => (
                        <button
                            key={t.value}
                            onClick={() => { setStatus(t.value); setCursor(null); setHistory([]); }}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
                                ${status === t.value
                                    ? "bg-white text-black"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* URL search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search URL…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onApply()}
                        className="h-9 w-48 pl-8 text-sm"
                    />
                </div>

                {/* Date range */}
                <div className="flex items-center gap-1.5">
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-36 text-sm" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-36 text-sm" />
                </div>

                <Button size="sm" onClick={onApply} className="h-9 bg-white text-black hover:bg-white/90">Apply</Button>
                {(query || fromDate || toDate || status !== "all") && (
                    <Button size="sm" variant="ghost" onClick={onClear} className="h-9 text-muted-foreground">Clear</Button>
                )}
            </div>

            {/* Summary bar */}
            {!loading && incidents.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{incidents.length} incident{incidents.length !== 1 ? "s" : ""} on page</span>
                    {activeCount > 0 && (
                        <span className="flex items-center gap-1.5 text-red-500">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                            </span>
                            {activeCount} active
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex h-56 items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading incidents…
                </div>
            ) : error ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => fetch(cursor)}>Retry</Button>
                </div>
            ) : (
                <>
                    <div className="rounded-xl border border-border overflow-hidden">
                        {incidents.length === 0 ? (
                            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                No incidents found.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                                        <th className="px-5 py-3 text-left font-medium">Monitor</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                        <th className="px-4 py-3 text-left font-medium">Started</th>
                                        <th className="px-4 py-3 text-left font-medium">Duration</th>
                                        <th className="px-4 py-3 text-left font-medium">HTTP</th>
                                        <th className="px-4 py-3 text-left font-medium">Latency</th>
                                        <th className="px-4 py-3 text-left font-medium">Alert</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incidents.map((inc, idx) => (
                                        <tr
                                            key={inc.id}
                                            className={`group transition-colors hover:bg-muted/30 ${idx !== incidents.length - 1 ? "border-b border-border" : ""}`}
                                        >
                                            {/* Monitor */}
                                            <td className="px-5 py-3.5">
                                                <Link
                                                    href={`/incidents/${inc.id}`}
                                                    className="flex items-center gap-1.5 font-medium hover:underline"
                                                >
                                                    {formatUrl(inc.monitor_url)}
                                                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </Link>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3.5">
                                                {inc.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-medium">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                                                        </span>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-emerald-500 text-xs font-medium">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                        Resolved
                                                    </span>
                                                )}
                                            </td>

                                            {/* Started */}
                                            <td className="px-4 py-3.5 text-muted-foreground">
                                                <span title={new Date(inc.start_time).toLocaleString()}>
                                                    {formatRelative(inc.start_time)}
                                                </span>
                                            </td>

                                            {/* Duration */}
                                            <td className="px-4 py-3.5">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDuration(inc.duration_sec)}
                                                </span>
                                            </td>

                                            {/* HTTP status */}
                                            <td className="px-4 py-3.5">
                                                <Badge variant="outline" className={`text-xs font-mono ${httpStatusColor(inc.http_status)}`}>
                                                    {inc.http_status || "—"}
                                                </Badge>
                                            </td>

                                            {/* Latency */}
                                            <td className="px-4 py-3.5">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Zap className="h-3 w-3" />
                                                    {inc.latency_ms > 0 ? `${inc.latency_ms} ms` : "—"}
                                                </span>
                                            </td>

                                            {/* Alert */}
                                            <td className="px-4 py-3.5">
                                                <AlertChip alert={inc.latest_alert} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {(history.length > 0 || hasMore) && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-sm text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{incidents.length}</span> incident{incidents.length !== 1 ? "s" : ""}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={onPrev} disabled={history.length === 0 || loading} className="h-8 gap-1 px-2.5">
                                    <ChevronLeft className="h-4 w-4" /> Prev
                                </Button>
                                <Button variant="outline" size="sm" onClick={onNext} disabled={!hasMore || loading} className="h-8 gap-1 px-2.5">
                                    Next <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
