"use client";

import { useState } from "react";
import {
    Globe,
    Clock,
    CircleCheck,
    CircleX,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    ShieldCheck,
} from "lucide-react";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Monitor } from "@/store/monitor-store";

// ── Types ──────────────────────────────────────────────────────────────
export type { Monitor };


interface MonitorsTableProps {
    monitors: Monitor[];
    limit: number;
    offset: number;
    totalCount?: number;
    onPageChange?: (newOffset: number) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatUrl(raw: string) {
    try {
        const u = new URL(raw);
        return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
        return raw;
    }
}

function formatInterval(sec: number) {
    if (sec >= 3600) return `${Math.round(sec / 3600)}h`;
    if (sec >= 60) return `${Math.round(sec / 60)}m`;
    return `${sec}s`;
}

// ── Component ──────────────────────────────────────────────────────────
export function MonitorsTable({
    monitors,
    limit,
    offset,
    totalCount,
    onPageChange,
}: MonitorsTableProps) {
    const currentPage = Math.floor(offset / limit) + 1;
    const total = totalCount ?? monitors.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;

    return (
        <div className="space-y-4">
            {/* Table */}
            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-5">URL</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Interval</TableHead>
                            <TableHead className="text-center">Expected</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {monitors.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="h-32 text-center text-muted-foreground"
                                >
                                    No monitors yet. Add one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            monitors.map((m) => (
                                <TableRow key={m.id} className="group">
                                    {/* URL */}
                                    <TableCell className="pl-5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                <Globe className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col">
                                                <a
                                                    href={m.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 font-medium hover:underline"
                                                >
                                                    {formatUrl(m.url)}
                                                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                                </a>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Enabled / Disabled */}
                                    <TableCell className="text-center">
                                        {m.enabled ? (
                                            <Badge
                                                variant="outline"
                                                className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            >
                                                <CircleCheck className="h-3 w-3" />
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="gap-1 border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                                            >
                                                <CircleX className="h-3 w-3" />
                                                Paused
                                            </Badge>
                                        )}
                                    </TableCell>

                                    {/* Interval */}
                                    <TableCell className="text-center">
                                        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5" />
                                            <span className="text-sm">
                                                Every {formatInterval(m.interval_sec)}
                                            </span>
                                        </div>
                                    </TableCell>

                                    {/* Expected Status */}
                                    <TableCell className="text-center">
                                        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            <span className="text-sm">{m.expected_status}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1">
                <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    <span className="font-medium text-foreground">
                        {monitors.length === 0 ? 0 : offset + 1}
                    </span>
                    –
                    <span className="font-medium text-foreground">
                        {Math.min(offset + limit, total)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-foreground">{total}</span>
                </p>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasPrev}
                        onClick={() => onPageChange?.(Math.max(0, offset - limit))}
                        className="h-8 gap-1 px-2.5"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                    </Button>

                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasNext}
                        onClick={() => onPageChange?.(offset + limit)}
                        className="h-8 gap-1 px-2.5"
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
