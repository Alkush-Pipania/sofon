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
    Power,
    Trash2,
    Loader2,
    MoreHorizontal,
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Monitor } from "@/store/monitor-store";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export type { Monitor };

interface MonitorsTableProps {
    monitors: Monitor[];
    limit: number;
    offset: number;
    totalCount?: number;
    onPageChange?: (newOffset: number) => void;
    onToggleStatus?: (monitorID: string, enable: boolean) => Promise<void>;
    onDelete?: (monitorID: string) => Promise<void>;
    updatingMonitorId?: string | null;
}

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

export function MonitorsTable({
    monitors,
    limit,
    offset,
    totalCount,
    onPageChange,
    onToggleStatus,
    onDelete,
    updatingMonitorId,
}: MonitorsTableProps) {
    const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);

    const currentPage = Math.floor(offset / limit) + 1;
    const total = totalCount ?? monitors.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;

    return (
        <div className="space-y-4">
            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-5">URL</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Interval</TableHead>
                            <TableHead className="text-center">Expected</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {monitors.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
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
                                    </TableCell>

                                    {/* Status */}
                                    <TableCell className="text-center">
                                        {m.enabled ? (
                                            <Badge
                                                variant="outline"
                                                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            >
                                                <span className="relative flex h-2 w-2">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                </span>
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="gap-1.5 border-zinc-500/30 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400"
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

                                    {/* 3-dot menu */}
                                    <TableCell className="pr-4">
                                        {updatingMonitorId === m.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        ) : (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedMonitor(m);
                                                            setToggleConfirmOpen(true);
                                                        }}
                                                    >
                                                        <Power className="mr-2 h-3.5 w-3.5" />
                                                        {m.enabled ? "Disable" : "Enable"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => {
                                                            setSelectedMonitor(m);
                                                            setDeleteConfirmOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
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

            {/* Toggle confirm dialog */}
            <Dialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedMonitor?.enabled ? "Disable monitor?" : "Enable monitor?"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedMonitor?.enabled
                                ? "This will stop future checks and alerting for this monitor until you enable it again."
                                : "This will resume scheduled checks and alerting for this monitor."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setToggleConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant={selectedMonitor?.enabled ? "destructive" : "default"}
                            disabled={!selectedMonitor || updatingMonitorId === selectedMonitor.id}
                            onClick={async () => {
                                if (!selectedMonitor || !onToggleStatus) return;
                                try {
                                    await onToggleStatus(selectedMonitor.id, !selectedMonitor.enabled);
                                    setToggleConfirmOpen(false);
                                    setSelectedMonitor(null);
                                } catch {
                                    // handled in store
                                }
                            }}
                        >
                            {updatingMonitorId === selectedMonitor?.id && (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete monitor?</DialogTitle>
                        <DialogDescription>
                            <span className="font-medium text-foreground">
                                {selectedMonitor ? formatUrl(selectedMonitor.url) : ""}
                            </span>{" "}
                            will be permanently deleted along with all its history. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!selectedMonitor || updatingMonitorId === selectedMonitor.id}
                            onClick={async () => {
                                if (!selectedMonitor || !onDelete) return;
                                try {
                                    await onDelete(selectedMonitor.id);
                                    setDeleteConfirmOpen(false);
                                    setSelectedMonitor(null);
                                } catch {
                                    // handled in store
                                }
                            }}
                        >
                            {updatingMonitorId === selectedMonitor?.id && (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
