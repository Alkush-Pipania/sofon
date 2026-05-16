"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Globe, Mail, Timer, Clock, Gauge, ShieldCheck, ArrowLeft, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMonitorStore, type CreateMonitorRequest } from "@/store/monitor-store";
import { useTeamStore } from "@/store/team-store";
import { parseApiError } from "@/lib/api-error";

interface MonitorFormData {
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
    latency_threshold_ms: 0,
    expected_status: 0,
};

const INTERVAL_PRESETS = [
    { label: "1m",  value: 60 },
    { label: "5m",  value: 300 },
    { label: "15m", value: 900 },
    { label: "30m", value: 1800 },
    { label: "1h",  value: 3600 },
];

const TIMEOUT_PRESETS = [
    { label: "2m",  value: 120 },
    { label: "5m",  value: 300 },
    { label: "10m", value: 600 },
    { label: "30m", value: 1800 },
];

function PresetPills({
    presets,
    value,
    onChange,
}: {
    presets: { label: string; value: number }[];
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
                <button
                    key={p.value}
                    type="button"
                    onClick={() => onChange(p.value)}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                        ${value === p.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}

function SectionHeader({ step, title, description }: { step: number; title: string; description?: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {step}
            </span>
            <div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                {description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                )}
            </div>
        </div>
    );
}

function FieldRow({
    icon: Icon,
    label,
    hint,
    optional,
    children,
}: {
    icon: React.ElementType;
    label: string;
    hint?: string;
    optional?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[1fr_2fr] gap-8 border-b border-border py-6 last:border-0">
            <div className="space-y-1 pt-0.5">
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    {optional && (
                        <Badge variant="outline" className="text-[10px] font-normal">optional</Badge>
                    )}
                </div>
                {hint && (
                    <p className="pl-6 text-xs leading-relaxed text-muted-foreground">{hint}</p>
                )}
            </div>
            <div className="flex flex-col justify-center">
                {children}
            </div>
        </div>
    );
}

export default function NewMonitorPage() {
    const router = useRouter();
    const createMonitor = useMonitorStore((s) => s.createMonitor);
    const currentTeam = useTeamStore((s) => s.currentTeam);

    useEffect(() => {
        if (currentTeam === null) {
            router.replace("/monitors");
        }
    }, [currentTeam, router]);

    const [form, setForm] = useState<MonitorFormData>({ ...DEFAULTS });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = <K extends keyof MonitorFormData>(key: K, value: MonitorFormData[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const { latency_threshold_ms, expected_status, ...rest } = form;
            const payload: CreateMonitorRequest = { ...rest };
            if (latency_threshold_ms) payload.latency_threshold_ms = latency_threshold_ms;
            if (expected_status) payload.expected_status = expected_status;
            await createMonitor(payload);
            router.push("/monitors");
        } catch (err) {
            setError(parseApiError(err, "Failed to create monitor."));
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full space-y-8">

            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <Link
                        href="/monitors"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to monitors
                    </Link>
                    <h1 className="pt-1 text-2xl font-bold tracking-tight">New Monitor</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure an endpoint to track. You&apos;ll get alerted the moment it goes down.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push("/monitors")}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="monitor-form"
                        disabled={submitting}
                        className="min-w-[140px] bg-white text-black hover:bg-white/90"
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitting ? "Creating…" : "Create Monitor"}
                    </Button>
                </div>
            </div>

            <form id="monitor-form" onSubmit={handleSubmit} className="space-y-4">

                {/* ── 1. Basics ── */}
                <Card className="gap-0 overflow-hidden py-0">
                    <div className="border-b border-border px-6 py-4">
                        <SectionHeader
                            step={1}
                            title="Basics"
                            description="The endpoint you want to monitor and where to send alerts."
                        />
                    </div>
                    <div className="px-6">
                        <FieldRow
                            icon={Globe}
                            label="Website URL"
                            hint="Must be a fully qualified URL including the protocol."
                        >
                            <Input
                                type="url"
                                placeholder="https://example.com"
                                required
                                value={form.url}
                                onChange={(e) => update("url", e.target.value)}
                                className="max-w-sm"
                                autoFocus
                            />
                        </FieldRow>

                        <FieldRow
                            icon={Mail}
                            label="Alert Email"
                            hint="Leave empty to use the default alert email from your server config."
                            optional
                        >
                            <Input
                                type="email"
                                placeholder="you@company.com"
                                value={form.alert_email}
                                onChange={(e) => update("alert_email", e.target.value)}
                                className="max-w-sm"
                            />
                        </FieldRow>
                    </div>
                </Card>

                {/* ── 2. Timing ── */}
                <Card className="gap-0 overflow-hidden py-0">
                    <div className="border-b border-border px-6 py-4">
                        <SectionHeader
                            step={2}
                            title="Timing"
                            description="How often to check and how long to wait for a response."
                        />
                    </div>
                    <div className="px-6">
                        <FieldRow
                            icon={Timer}
                            label="Check Interval"
                            hint="How frequently the monitor pings your endpoint. Minimum 60 s."
                        >
                            <div className="space-y-2.5">
                                <PresetPills
                                    presets={INTERVAL_PRESETS}
                                    value={form.interval_sec}
                                    onChange={(v) => update("interval_sec", v)}
                                />
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={60}
                                        required
                                        value={form.interval_sec}
                                        onChange={(e) => update("interval_sec", Number(e.target.value))}
                                        className="w-24"
                                    />
                                    <span className="text-sm text-muted-foreground">seconds</span>
                                </div>
                            </div>
                        </FieldRow>

                        <FieldRow
                            icon={Clock}
                            label="Timeout"
                            hint="Max time to wait for a response before marking the endpoint as down. Minimum 120 s."
                        >
                            <div className="space-y-2.5">
                                <PresetPills
                                    presets={TIMEOUT_PRESETS}
                                    value={form.timeout_sec}
                                    onChange={(v) => update("timeout_sec", v)}
                                />
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={120}
                                        value={form.timeout_sec}
                                        onChange={(e) => update("timeout_sec", Number(e.target.value))}
                                        className="w-24"
                                    />
                                    <span className="text-sm text-muted-foreground">seconds</span>
                                </div>
                            </div>
                        </FieldRow>
                    </div>
                </Card>

                {/* ── 3. Thresholds ── */}
                <Card className="gap-0 overflow-hidden py-0">
                    <div className="border-b border-border px-6 py-4">
                        <SectionHeader
                            step={3}
                            title="Thresholds"
                            description="Optional conditions that trigger an alert beyond just being unreachable."
                        />
                    </div>
                    <div className="px-6">
                        <FieldRow
                            icon={Gauge}
                            label="Latency Threshold"
                            hint="Trigger an alert if the response time exceeds this value. Set to 0 to disable."
                            optional
                        >
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.latency_threshold_ms}
                                    onChange={(e) => update("latency_threshold_ms", Number(e.target.value))}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">ms</span>
                            </div>
                        </FieldRow>

                        <FieldRow
                            icon={ShieldCheck}
                            label="Expected Status Code"
                            hint="Alert if the response status doesn't match. E.g. 200. Set to 0 to accept any 2xx."
                            optional
                        >
                            <Input
                                type="number"
                                min={0}
                                max={599}
                                value={form.expected_status}
                                onChange={(e) => update("expected_status", Number(e.target.value))}
                                className="w-24"
                            />
                        </FieldRow>
                    </div>
                </Card>

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

            </form>
        </div>
    );
}
