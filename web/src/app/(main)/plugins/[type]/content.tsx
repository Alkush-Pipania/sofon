"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    AlertCircle, ArrowLeft, Check, CheckCircle2,
    Loader2, Plus, Trash2, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { usePluginStore } from "@/store/plugin-store";
import { useTeamStore } from "@/store/team-store";
import { PLUGIN_REGISTRY } from "../registry";

// ── Field definitions ─────────────────────────────────────────────────────

interface FieldDef {
    key: string;
    label: string;
    placeholder: string;
    type?: string;
    multiValue?: boolean;
}

// Layout: each inner array = one row; 2 keys = 2-col grid, 1 key = full width
const PLUGIN_LAYOUT: Record<string, string[][]> = {
    resend:   [["api_key", "sender_email"], ["recipient_emails"]],
    zenduty:  [["integration_url"]],
};

const PLUGIN_FIELDS: Record<string, FieldDef[]> = {
    resend: [
        { key: "api_key",          label: "API Key",             placeholder: "re_xxxxxxxxxxxxxxxxxxxx",          type: "password" },
        { key: "sender_email",     label: "From",                placeholder: "alerts@yourdomain.com",            type: "email"    },
        { key: "recipient_emails", label: "Recipients",          placeholder: "you@example.com",                  type: "email", multiValue: true },
    ],
    zenduty: [
        { key: "integration_url",  label: "Webhook URL",         placeholder: "https://events.zenduty.com/integration/…" },
    ],
};

// ── Multi-value email list ────────────────────────────────────────────────

function EmailList({ values, placeholder, onChange }: {
    values: string[];
    placeholder: string;
    onChange: (v: string[]) => void;
}) {
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const add = () => {
        const v = draft.trim();
        if (!v || values.includes(v)) return;
        onChange([...values, v]);
        setDraft("");
        inputRef.current?.focus();
    };

    return (
        <div className="space-y-2">
            {values.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {values.map((email, idx) => (
                        <div key={idx}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 pl-2.5 pr-1.5 py-1">
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                            <span className="text-xs font-mono text-foreground">{email}</span>
                            <button type="button" onClick={() => onChange(values.filter((_, i) => i !== idx))}
                                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <Input
                    ref={inputRef}
                    type="email"
                    placeholder={placeholder}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                    className="font-mono text-sm h-9"
                />
                <Button type="button" variant="outline" size="sm" onClick={add}
                    className="shrink-0 h-9 px-3 gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add
                </Button>
            </div>
        </div>
    );
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ enabled, configured }: { enabled: boolean; configured: boolean }) {
    if (!configured) return (
        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs">Not configured</Badge>
    );
    if (enabled) return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Active
        </Badge>
    );
    return <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-400 text-xs">Disabled</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PluginDetailPage() {
    const params = useParams<{ type: string }>();
    const router = useRouter();
    const pluginType = params.type;

    const def    = PLUGIN_REGISTRY.find((p) => p.type === pluginType);
    const fields = PLUGIN_FIELDS[pluginType] ?? [];
    const layout = PLUGIN_LAYOUT[pluginType] ?? fields.map((f) => [f.key]);

    const currentTeam = useTeamStore((s) => s.currentTeam);
    const { saving, fetchPlugin, upsertPlugin, deletePlugin } = usePluginStore();

    const [singleFields, setSingleFields] = useState<Record<string, string>>({});
    const [multiFields,  setMultiFields]  = useState<Record<string, string[]>>({});
    const [enabled,      setEnabled]      = useState(false);
    const [configured,   setConfigured]   = useState(false);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState<string | null>(null);
    const [saved,        setSaved]        = useState(false);
    const [deleting,     setDeleting]     = useState(false);

    useEffect(() => {
        if (!currentTeam || !def) return;
        (async () => {
            setLoading(true);
            const plugin = await fetchPlugin(pluginType);
            if (plugin) {
                setConfigured(true);
                setEnabled(plugin.enabled);
                const singles: Record<string, string>   = {};
                const multis:  Record<string, string[]> = {};
                for (const f of fields) {
                    if (f.multiValue) {
                        const raw = plugin.config?.[f.key] ?? "";
                        multis[f.key] = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
                    } else {
                        singles[f.key] = plugin.config?.[f.key] ?? "";
                    }
                }
                setSingleFields(singles);
                setMultiFields(multis);
            } else {
                setConfigured(false);
                setEnabled(false);
                const singles: Record<string, string>   = {};
                const multis:  Record<string, string[]> = {};
                for (const f of fields) {
                    if (f.multiValue) multis[f.key] = [];
                    else singles[f.key] = "";
                }
                setSingleFields(singles);
                setMultiFields(multis);
            }
            setLoading(false);
        })();
    }, [currentTeam?.id, pluginType]);

    if (!def) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-muted-foreground text-sm">Plugin not found.</p>
            <Link href="/plugins" className="text-sm underline underline-offset-2">Back to plugins</Link>
        </div>
    );

    const Icon = def.icon;

    const handleSave = async () => {
        setError(null);
        setSaved(false);
        try {
            const config: Record<string, string> = { ...singleFields };
            for (const [key, vals] of Object.entries(multiFields)) config[key] = vals.join(",");
            await upsertPlugin(pluginType, enabled, config);
            setConfigured(true);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Remove this plugin? All configuration will be lost.")) return;
        setDeleting(true);
        setError(null);
        try {
            await deletePlugin(pluginType);
            router.push("/plugins");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove");
            setDeleting(false);
        }
    };

    const fieldMap     = Object.fromEntries(fields.map((f) => [f.key, f]));
    const singlesFilled = fields.filter((f) => !f.multiValue).every((f) => singleFields[f.key]?.trim());

    return (
        <div className="w-full space-y-6">

            {/* Back */}
            <Link href="/plugins"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
                Plugins
            </Link>

            {/* Page header: icon + name + save button in one row */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted border border-border">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight leading-none">{def.name}</h1>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground">{def.category}</span>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <StatusBadge enabled={enabled} configured={configured} />
                        </div>
                    </div>
                </div>

                {/* Save — lives in the header, always visible */}
                <Button
                    onClick={handleSave}
                    disabled={saving || !singlesFilled}
                    size="sm"
                    className="bg-white text-black hover:bg-white/90 gap-2 px-5"
                >
                    {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : saved ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : null}
                    {saved ? "Saved!" : "Save Changes"}
                </Button>
            </div>

            {loading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                </div>
            ) : (
                <div className="space-y-4">

                    {/* Configuration card */}
                    <Card className="py-0 overflow-hidden gap-0">
                        <div className="border-b border-border px-5 py-3">
                            <p className="text-sm font-semibold">Configuration</p>
                        </div>
                        <div className="px-5 py-5 space-y-5">

                            {/* Render rows from layout spec */}
                            {layout.map((row, rowIdx) => (
                                <div
                                    key={rowIdx}
                                    className={row.length === 2
                                        ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                                        : ""}
                                >
                                    {row.map((key) => {
                                        const f = fieldMap[key];
                                        if (!f) return null;
                                        return (
                                            <div key={key} className="space-y-1.5">
                                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    {f.label}
                                                </Label>
                                                {f.multiValue ? (
                                                    <EmailList
                                                        values={multiFields[f.key] ?? []}
                                                        placeholder={f.placeholder}
                                                        onChange={(v) => setMultiFields((prev) => ({ ...prev, [f.key]: v }))}
                                                    />
                                                ) : (
                                                    <Input
                                                        type={f.type ?? "text"}
                                                        placeholder={f.placeholder}
                                                        value={singleFields[f.key] ?? ""}
                                                        onChange={(e) => setSingleFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                                        className="font-mono text-sm h-9"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* Enable / Disable toggle row */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">
                                        {enabled ? "Plugin enabled" : "Plugin disabled"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {enabled
                                            ? "Alerts are dispatched through this plugin."
                                            : "No alerts will be sent through this plugin."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    onClick={() => setEnabled(!enabled)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
                                        enabled ? "bg-white" : "bg-zinc-700"
                                    }`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-black shadow-lg transition-transform ${
                                        enabled ? "translate-x-5" : "translate-x-0"
                                    }`} />
                                </button>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Danger zone */}
                    {configured && (
                        <Card className="py-0 overflow-hidden gap-0 border-destructive/20">
                            <div className="border-b border-destructive/20 px-5 py-3">
                                <p className="text-sm font-semibold text-destructive">Danger Zone</p>
                            </div>
                            <div className="px-5 py-4 flex items-center justify-between gap-6">
                                <p className="text-sm text-muted-foreground">
                                    Permanently remove this plugin and all its configuration.
                                </p>
                                <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}
                                    className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5">
                                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    Remove
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
