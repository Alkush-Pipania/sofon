"use client";

import { useEffect, useState } from "react";
import { usePluginStore, type Plugin } from "@/store/plugin-store";
import { useTeamStore } from "@/store/team-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertCircle, BellRing, Check, ChevronRight, Loader2, Mail, Settings, Trash2,
} from "lucide-react";

// ── Plugin registry (add future plugins here) ─────────────────────────────

interface PluginDef {
    type: string;
    name: string;
    description: string;
    icon: React.ElementType;
    fields: { key: string; label: string; placeholder: string; type?: string; hint?: string }[];
}

const PLUGIN_REGISTRY: PluginDef[] = [
    {
        type: "resend",
        name: "Resend Email",
        description: "Send incident alert emails via the Resend API.",
        icon: Mail,
        fields: [
            {
                key: "api_key",
                label: "API Key",
                placeholder: "re_xxxxxxxxxxxxxxxxxxxx",
                type: "password",
            },
            {
                key: "sender_email",
                label: "Sender Email (From)",
                placeholder: "alerts@yourdomain.com",
                type: "email",
                hint: "Must be a verified sender domain in your Resend account.",
            },
            {
                key: "recipient_email",
                label: "Alert Recipient Email (To)",
                placeholder: "you@example.com",
                type: "email",
                hint: "Incident alerts will be delivered to this address.",
            },
        ],
    },
    {
        type: "zenduty",
        name: "Zenduty",
        description: "Create and auto-resolve Zenduty incidents when monitors go down.",
        icon: BellRing,
        fields: [
            {
                key: "integration_url",
                label: "Integration Webhook URL",
                placeholder: "https://events.zenduty.com/integration/.../generic/.../",
                hint: "Found in Zenduty → Service → Integrations → Generic Integration → Configure.",
            },
        ],
    },
];

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

// ── Configure dialog ──────────────────────────────────────────────────────

interface ConfigDialogProps {
    def: PluginDef;
    plugin: Plugin | null;
    open: boolean;
    onClose: () => void;
    onSave: (enabled: boolean, config: Record<string, string>) => Promise<Plugin>;
    onDelete: () => Promise<void>;
    saving: boolean;
}

function ConfigDialog({ def, plugin, open, onClose, onSave, onDelete, saving }: ConfigDialogProps) {
    const [fields, setFields] = useState<Record<string, string>>({});
    const [enabled, setEnabled] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            const initial: Record<string, string> = {};
            for (const f of def.fields) {
                initial[f.key] = plugin?.config?.[f.key] ?? "";
            }
            setFields(initial);
            setEnabled(plugin?.enabled ?? false);
            setError(null);
            setSaved(false);
        }
    }, [open, plugin?.id]);

    const handleSave = async () => {
        setError(null);
        setSaved(false);
        try {
            await onSave(enabled, fields);
            setSaved(true);
            setTimeout(() => { setSaved(false); onClose(); }, 1200);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to save");
        }
    };

    const handleDelete = async () => {
        setError(null);
        try {
            await onDelete();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to remove");
        }
    };

    const allFilled = def.fields.every((f) => fields[f.key]?.trim());

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                            <def.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <DialogTitle className="text-base">{def.name}</DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">{def.description}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                    {def.fields.map((f) => (
                        <div key={f.key} className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{f.label}</Label>
                            <Input
                                type={f.type ?? "text"}
                                placeholder={f.placeholder}
                                value={fields[f.key] ?? ""}
                                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                className="text-sm font-mono"
                            />
                            {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                        </div>
                    ))}

                    {/* Enable toggle */}
                    <div className="flex items-center gap-3 py-1">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() => setEnabled(!enabled)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                enabled ? "bg-white" : "bg-zinc-700"
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-black shadow-lg transition-transform ${
                                    enabled ? "translate-x-4" : "translate-x-0"
                                }`}
                            />
                        </button>
                        <span className="text-sm text-muted-foreground">
                            {enabled ? "Enabled — alerts will be sent" : "Disabled — alerts will be skipped"}
                        </span>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={saving || !allFilled}
                                className="bg-white text-black hover:bg-white/90 h-8"
                            >
                                {saving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : saved ? (
                                    <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                                ) : null}
                                {saved ? "Saved!" : "Save"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={onClose} className="h-8">
                                Cancel
                            </Button>
                        </div>
                        {plugin && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleDelete}
                                disabled={saving}
                                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Remove
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PluginsPage() {
    const currentTeam = useTeamStore((s) => s.currentTeam);
    const { plugins, loading, saving, fetchPlugins, fetchPlugin, upsertPlugin, deletePlugin } = usePluginStore();

    const [selected, setSelected] = useState<PluginDef | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<Plugin | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        if (!currentTeam) return;
        fetchPlugins();
    }, [currentTeam?.id]);

    const openConfig = async (def: PluginDef) => {
        setSelected(def);
        setDetailLoading(true);
        const detail = await fetchPlugin(def.type);
        setSelectedDetail(detail);
        setDetailLoading(false);
    };

    const closeConfig = () => {
        setSelected(null);
        setSelectedDetail(null);
    };

    if (!currentTeam) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No team selected.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Plugins</h1>
                <p className="text-sm text-muted-foreground">
                    Manage notification integrations for your team.
                </p>
            </div>

            {/* Plugin table */}
            {loading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading plugins…
                </div>
            ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                                <th className="px-5 py-3 text-left font-medium">Integration</th>
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                <th className="px-4 py-3 text-left font-medium">Last updated</th>
                                <th className="px-4 py-3 text-right font-medium"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {PLUGIN_REGISTRY.map((def, idx) => {
                                const live = plugins.find((p) => p.type === def.type);
                                const Icon = def.icon;
                                return (
                                    <tr
                                        key={def.type}
                                        className={`group transition-colors hover:bg-muted/30 cursor-pointer ${
                                            idx !== PLUGIN_REGISTRY.length - 1 ? "border-b border-border" : ""
                                        }`}
                                        onClick={() => openConfig(def)}
                                    >
                                        {/* Name + description */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{def.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-4">
                                            <PluginStatusBadge plugin={live} />
                                        </td>

                                        {/* Last updated */}
                                        <td className="px-4 py-4 text-muted-foreground text-xs">
                                            {live
                                                ? new Date(live.updated_at).toLocaleDateString(undefined, {
                                                    year: "numeric", month: "short", day: "numeric",
                                                })
                                                : "—"}
                                        </td>

                                        {/* Configure button */}
                                        <td className="px-4 py-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                                onClick={(e) => { e.stopPropagation(); openConfig(def); }}
                                            >
                                                <Settings className="h-3.5 w-3.5" />
                                                Configure
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Config dialog */}
            {selected && (
                detailLoading ? null : (
                    <ConfigDialog
                        def={selected}
                        plugin={selectedDetail}
                        open={!!selected}
                        onClose={closeConfig}
                        onSave={async (enabled, config) => {
                            const updated = await upsertPlugin(selected.type, enabled, config);
                            return updated;
                        }}
                        onDelete={async () => {
                            await deletePlugin(selected.type);
                            await fetchPlugins();
                        }}
                        saving={saving}
                    />
                )
            )}
        </div>
    );
}
