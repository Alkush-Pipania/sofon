"use client";

import { useEffect, useState } from "react";
import { useMonitorStore } from "@/store/monitor-store";
import { useTeamStore } from "@/store/team-store";
import { MonitorsTable } from "@/components/monitors/monitors-table";
import { Loader2, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

export default function MonitorsPage() {
    const {
        monitors,
        hasMore,
        hasPrev,
        loading,
        error,
        updatingMonitorId,
        fetchMonitors,
        goNext,
        goPrev,
        updateMonitorStatus,
        deleteMonitor,
    } = useMonitorStore();

    const { currentTeam, createTeam } = useTeamStore();
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (currentTeam) fetchMonitors();
    }, [fetchMonitors, currentTeam]);

    const handleCreateTeam = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await createTeam(newName.trim());
            setCreateOpen(false);
            setNewName("");
        } finally {
            setCreating(false);
        }
    };

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
                        disabled={loading || !currentTeam}
                        className="gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        asChild={!!currentTeam}
                        size="sm"
                        disabled={!currentTeam}
                        className="gap-1.5 bg-white text-black hover:bg-white/90"
                    >
                        {currentTeam ? (
                            <Link href="/monitors/new">
                                <Plus className="h-4 w-4" />
                                New
                            </Link>
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                New
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* No team state */}
            {!currentTeam ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border bg-card">
                    <p className="text-sm text-muted-foreground">
                        You need a team before you can create monitors.
                    </p>
                    <Button
                        size="sm"
                        className="bg-white text-black hover:bg-white/90"
                        onClick={() => setCreateOpen(true)}
                    >
                        Create Team
                    </Button>
                </div>
            ) : loading && monitors.length === 0 ? (
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
                    hasMore={hasMore}
                    hasPrev={hasPrev}
                    onNext={goNext}
                    onPrev={goPrev}
                    onToggleStatus={updateMonitorStatus}
                    onDelete={deleteMonitor}
                    updatingMonitorId={updatingMonitorId}
                />
            )}

            {/* Create team dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Create a new team</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="Give your organization a name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                        className="h-10 bg-white/5 border-white/10 focus-visible:ring-primary"
                        autoFocus
                    />
                    <DialogFooter className="pt-1">
                        <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreateTeam}
                            disabled={creating || !newName.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Create team
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
