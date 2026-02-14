"use client";

import { useState } from "react";
import {
    Globe,
    Mail,
    Timer,
    Clock,
    Gauge,
    ShieldCheck,
    ChevronDown,
    Plus,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMonitorStore } from "@/store/monitor-store";
import { AxiosError } from "axios";

interface NewMonitorDialogProps {
    trigger?: React.ReactNode;
}

export interface MonitorFormData {
    url: string;
    alert_email: string;
    interval_sec: number;
    timeout_sec: number;
    latency_threshold_ms: number;
    expected_status: number;
}

const DEFAULTS: MonitorFormData = {
    url: "",
    alert_email: "",
    interval_sec: 60,
    timeout_sec: 120,
    latency_threshold_ms: 200,
    expected_status: 200,
};

export function NewMonitorDialog({ trigger }: NewMonitorDialogProps) {
    const [open, setOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [form, setForm] = useState<MonitorFormData>({ ...DEFAULTS });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const createMonitor = useMonitorStore((s) => s.createMonitor);

    const update = <K extends keyof MonitorFormData>(
        key: K,
        value: MonitorFormData[K]
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await createMonitor(form);
            setOpen(false);
            setForm({ ...DEFAULTS });
            setShowAdvanced(false);
        } catch (err: unknown) {
            if (err instanceof AxiosError) {
                const msg = err.response?.data?.message || err.response?.data?.error;
                setError(msg || "Failed to create monitor.");
            } else {
                setError("Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setForm({ ...DEFAULTS });
            setShowAdvanced(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className="gap-1.5 bg-[#3B8CF0] text-white hover:bg-[#3B8CF0]/90">
                        <Plus className="h-4 w-4" />
                        New
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>New Monitor</DialogTitle>
                    <DialogDescription>
                        Add an endpoint to track its uptime and get alerts when
                        it goes down.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                    {/* ── Basic Fields ──────────────────────────────── */}

                    {/* URL */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="mon-url"
                            className="flex items-center gap-1.5 text-sm font-medium"
                        >
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            Website URL
                        </Label>
                        <Input
                            id="mon-url"
                            type="url"
                            placeholder="https://example.com"
                            required
                            value={form.url}
                            onChange={(e) => update("url", e.target.value)}
                        />
                    </div>

                    {/* Alert Email */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="mon-email"
                            className="flex items-center gap-1.5 text-sm font-medium"
                        >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            Alert Email
                        </Label>
                        <Input
                            id="mon-email"
                            type="email"
                            placeholder="you@company.com"
                            required
                            value={form.alert_email}
                            onChange={(e) =>
                                update("alert_email", e.target.value)
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            We&apos;ll notify you here when your site goes down.
                        </p>
                    </div>

                    {/* Check Interval */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="mon-interval"
                            className="flex items-center gap-1.5 text-sm font-medium"
                        >
                            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                            Check Every
                        </Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="mon-interval"
                                type="number"
                                min={10}
                                required
                                value={form.interval_sec}
                                onChange={(e) =>
                                    update(
                                        "interval_sec",
                                        Number(e.target.value)
                                    )
                                }
                                className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">
                                seconds
                            </span>
                        </div>
                    </div>

                    {/* ── Advanced Toggle ───────────────────────────── */}
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((p) => !p)}
                        className="flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""
                                }`}
                        />
                        Advanced Settings
                    </button>

                    {showAdvanced && (
                        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                            {/* Timeout */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="mon-timeout"
                                    className="flex items-center gap-1.5 text-sm font-medium"
                                >
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    Timeout
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="mon-timeout"
                                        type="number"
                                        min={1}
                                        value={form.timeout_sec}
                                        onChange={(e) =>
                                            update(
                                                "timeout_sec",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="w-24"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        seconds
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Max time to wait for a response before
                                    marking it as down.
                                </p>
                            </div>

                            {/* Latency Threshold */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="mon-latency"
                                    className="flex items-center gap-1.5 text-sm font-medium"
                                >
                                    <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                                    Latency Threshold
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="mon-latency"
                                        type="number"
                                        min={1}
                                        value={form.latency_threshold_ms}
                                        onChange={(e) =>
                                            update(
                                                "latency_threshold_ms",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="w-24"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        ms
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Alert if response time exceeds this value.
                                </p>
                            </div>

                            {/* Expected Status */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="mon-status"
                                    className="flex items-center gap-1.5 text-sm font-medium"
                                >
                                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                    Expected Status Code
                                </Label>
                                <Input
                                    id="mon-status"
                                    type="number"
                                    min={100}
                                    max={599}
                                    value={form.expected_status}
                                    onChange={(e) =>
                                        update(
                                            "expected_status",
                                            Number(e.target.value)
                                        )
                                    }
                                    className="w-24"
                                />
                                <p className="text-xs text-muted-foreground">
                                    HTTP status code your endpoint should
                                    return (e.g. 200).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Actions ───────────────────────────────────── */}
                    {error && (
                        <p className="text-center text-sm text-destructive">{error}</p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="bg-[#3B8CF0] text-white hover:bg-[#3B8CF0]/90"
                        >
                            {submitting ? "Creating..." : "Create Monitor"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
