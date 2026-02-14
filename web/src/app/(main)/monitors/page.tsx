"use client";

import { useEffect } from "react";
import { useMonitorStore, type Monitor } from "@/store/monitor-store";
import { MonitorsTable } from "@/components/monitors/monitors-table";
import { NewMonitorDialog } from "@/components/monitors/new-monitor-dialog";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MonitorsPage() {
    const { monitors, limit, offset, loading, error, fetchMonitors, setOffset } =
        useMonitorStore();

    useEffect(() => {
        fetchMonitors();
    }, [fetchMonitors]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Monitors</h1>
                    <p className="text-sm text-muted-foreground">
                        Track the uptime of your endpoints.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMonitors()}
                        disabled={loading}
                        className="gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <NewMonitorDialog />
                </div>
            </div>

            {/* Content */}
            {loading && monitors.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading monitors...</p>
                </div>
            ) : error ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMonitors()}
                        className="gap-1.5"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                    </Button>
                </div>
            ) : (
                <MonitorsTable
                    monitors={monitors}
                    limit={limit}
                    offset={offset}
                    totalCount={monitors.length}
                    onPageChange={setOffset}
                />
            )}
        </div>
    );
}
