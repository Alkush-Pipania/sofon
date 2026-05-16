"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Copy, Check, Loader2, MoreHorizontal, UserPlus, UserX, UserCheck, Mail, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { get, put, post, del, patch } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";
import { useTeamStore } from "@/store/team-store";

// ── Types ──────────────────────────────────────────────────────
interface MemberResponse { success: boolean; data: Member[] }
interface InvitationsResponse { success: boolean; data: Invitation[] }

interface Member {
    id: string; name: string; email: string; role: string; is_active: boolean; created_at: string;
}

interface Invitation {
    id: string; email: string; role: string; link: string;
    expires_at: string; accepted: boolean; created_at: string;
}

interface CurrentUser { id: string; role: string }
interface InviteForm { email: string; role: string }
interface TeamNameForm { name: string }

// ── Helpers ────────────────────────────────────────────────────
const MEMBER_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f97316", "#f43f5e", "#06b6d4"];

function memberColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

function MemberAvatar({ name }: { name: string }) {
    const color = memberColor(name);
    return (
        <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: "#0d0d0d", background: `radial-gradient(circle at center, ${color} 0%, transparent 75%)` }}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

const roleBadgeClass: Record<string, string> = {
    owner:  "border-purple-500/30 bg-purple-500/10 text-purple-500",
    admin:  "border-blue-500/30 bg-blue-500/10 text-blue-500",
    member: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

function RoleBadge({ role }: { role: string }) {
    return (
        <Badge variant="outline" className={`capitalize text-xs ${roleBadgeClass[role] ?? ""}`}>
            {role}
        </Badge>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
    );
}

// ── Page ───────────────────────────────────────────────────────
export default function TeamPage() {
    const { currentTeam, fetchTeams } = useTeamStore();

    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [me, setMe] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    const [updatingMember, setUpdatingMember] = useState<string | null>(null);
    const [confirmMember, setConfirmMember] = useState<Member | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteResult, setInviteResult] = useState<Invitation | null>(null);
    const [inviteRole, setInviteRole] = useState("member");
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const inviteForm = useForm<InviteForm>();
    const nameForm = useForm<TeamNameForm>();

    const fetchAll = async () => {
        if (!currentTeam) return;
        setLoading(true);
        try {
            const [m, i, profile] = await Promise.all([
                get<MemberResponse>(ENDPOINTS.TEAMS.MEMBERS(currentTeam.id)),
                get<InvitationsResponse>(ENDPOINTS.TEAMS.INVITATIONS(currentTeam.id)).catch(() => ({ data: [] as Invitation[] })),
                get<{ success: boolean; data: { id: string } }>(ENDPOINTS.USERS.ME),
            ]);
            nameForm.reset({ name: currentTeam.name });
            const memberList = m.data ?? [];
            setMembers(memberList);
            const myId = profile.data.id;
            const myMembership = memberList.find((mem) => mem.id === myId);
            setMe({ id: myId, role: myMembership?.role ?? "" });
            const now = new Date();
            setInvitations((i.data ?? []).filter((inv) => !inv.accepted && new Date(inv.expires_at) > now));
        } catch {
            // silently fail — table will show empty
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [currentTeam?.id]);

    const onSaveName = async (data: TeamNameForm) => {
        if (!currentTeam) return;
        setNameError(null);
        setSavingName(true);
        try {
            await put(ENDPOINTS.TEAMS.UPDATE(currentTeam.id), { name: data.name });
            await fetchTeams();
        } catch (err) {
            setNameError(parseApiError(err, "Failed to update team name."));
        } finally {
            setSavingName(false);
        }
    };

    const onInvite = async (data: InviteForm) => {
        if (!currentTeam) return;
        setInviteError(null);
        try {
            const res = await post<{ success: boolean; data: Invitation }>(
                ENDPOINTS.TEAMS.INVITATIONS(currentTeam.id),
                { email: data.email, role: inviteRole },
            );
            setInviteResult(res.data);
            setInvitations((prev) => [res.data, ...prev]);
            inviteForm.reset();
        } catch (err) {
            setInviteError(parseApiError(err, "Failed to create invitation."));
        }
    };

    const setMemberActive = async (userId: string, active: boolean) => {
        if (!currentTeam) return;
        setUpdatingMember(userId);
        try {
            await patch(ENDPOINTS.TEAMS.SET_MEMBER_ACTIVE(currentTeam.id, userId), { active });
            setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, is_active: active } : m));
        } catch {
            // ignore
        } finally {
            setUpdatingMember(null);
            setConfirmMember(null);
        }
    };

    const revokeInvitation = async (id: string) => {
        if (!currentTeam) return;
        setRevoking(id);
        try {
            await del(ENDPOINTS.TEAMS.REVOKE_INVITATION(currentTeam.id, id));
            setInvitations((prev) => prev.filter((i) => i.id !== id));
        } catch {
            // ignore
        } finally {
            setRevoking(null);
        }
    };

    if (!currentTeam) {
        return (
            <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
                No team selected. Create or join a team first.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{currentTeam.name}</h1>
                <p className="text-sm text-muted-foreground">Manage your team settings and members.</p>
            </div>

            <Tabs defaultValue="general">
                <TabsList className="w-fit">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="members">Members</TabsTrigger>
                </TabsList>

                {/* ── General Tab ── */}
                <TabsContent value="general" className="mt-6">
                    <Card className="max-w-lg">
                        <CardHeader>
                            <CardTitle className="text-base">Team name</CardTitle>
                            <CardDescription>
                                This is the display name for your team across the app.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={nameForm.handleSubmit(onSaveName)} className="flex flex-col gap-4">
                                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                                <div className="flex gap-3">
                                    <Input
                                        {...nameForm.register("name", { required: true, minLength: 1 })}
                                        placeholder="My Team"
                                        className="max-w-xs"
                                    />
                                    <Button type="submit" disabled={savingName} size="sm">
                                        {savingName && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                        Save
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Members Tab ── */}
                <TabsContent value="members" className="mt-6 space-y-4">

                    {/* Header row */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold">{members.length} member{members.length !== 1 ? "s" : ""}</p>
                            <p className="text-xs text-muted-foreground">People with access to {currentTeam.name}</p>
                        </div>
                        {(me?.role === "owner" || me?.role === "admin") && (
                            <Button
                                size="sm"
                                className="gap-1.5 bg-white text-black hover:bg-white/90"
                                onClick={() => { setInviteResult(null); setInviteOpen(true); }}
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                Invite member
                            </Button>
                        )}
                    </div>

                    {/* Members list */}
                    <div className="rounded-xl border border-border overflow-hidden">
                        {members.map((m, idx) => {
                            const canManage =
                                me?.id !== m.id &&
                                (me?.role === "owner" || me?.role === "admin") &&
                                !(m.role === "owner" && me?.role !== "owner");

                            return (
                                <div
                                    key={m.id}
                                    className={`flex items-center gap-4 px-5 py-3.5 ${idx !== members.length - 1 ? "border-b border-border" : ""} ${!m.is_active ? "opacity-50" : ""}`}
                                >
                                    <MemberAvatar name={m.name} />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{m.name}</span>
                                            {me?.id === m.id && (
                                                <span className="rounded-full border border-zinc-600/40 px-1.5 py-0 text-[10px] text-zinc-500">you</span>
                                            )}
                                            {!m.is_active && (
                                                <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-500 text-[10px] px-1.5 py-0">
                                                    deactivated
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <RoleBadge role={m.role} />

                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-24 justify-end">
                                            <Clock className="h-3 w-3 shrink-0" />
                                            {new Date(m.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                        </div>

                                        <div className="w-8 flex justify-center">
                                            {updatingMember === m.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            ) : canManage ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        {m.is_active ? (
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => setConfirmMember(m)}
                                                            >
                                                                <UserX className="mr-2 h-3.5 w-3.5" />
                                                                Deactivate
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem onClick={() => setMemberActive(m.id, true)}>
                                                                <UserCheck className="mr-2 h-3.5 w-3.5" />
                                                                Activate
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pending invitations */}
                    {invitations.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold">Pending invitations</p>
                            <div className="rounded-xl border border-border overflow-hidden">
                                {invitations.map((inv, idx) => (
                                    <div
                                        key={inv.id}
                                        className={`flex items-center gap-4 px-5 py-3.5 ${idx !== invitations.length - 1 ? "border-b border-border" : ""}`}
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{inv.email}</p>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                Expires {new Date(inv.expires_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <RoleBadge role={inv.role} />

                                            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1 max-w-[180px]">
                                                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                                                    {inv.link}
                                                </span>
                                                <CopyButton text={inv.link} />
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                disabled={revoking === inv.id}
                                                onClick={() => revokeInvitation(inv.id)}
                                            >
                                                {revoking === inv.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <UserX className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Deactivate confirm dialog */}
            <Dialog open={!!confirmMember} onOpenChange={(o) => { if (!o) setConfirmMember(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Deactivate member?</DialogTitle>
                        <DialogDescription>
                            <span className="font-medium text-foreground">{confirmMember?.name}</span>
                            {" "}will lose access to this team immediately. Their data is preserved and you can reactivate them later.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmMember(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={updatingMember === confirmMember?.id}
                            onClick={() => confirmMember && setMemberActive(confirmMember.id, false)}
                        >
                            {updatingMember === confirmMember?.id && (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            Deactivate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invite dialog */}
            <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteResult(null); setInviteError(null); inviteForm.reset(); } }}>
                <DialogContent className="sm:max-w-md">
                    {inviteResult ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Invitation created</DialogTitle>
                                <DialogDescription>
                                    Share this link with <span className="font-medium text-foreground">{inviteResult.email}</span>. It expires in 48 hours.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                                <span className="min-w-0 flex-1 truncate font-mono text-xs">{inviteResult.link}</span>
                                <CopyButton text={inviteResult.link} />
                            </div>
                            <DialogFooter>
                                <Button onClick={() => { setInviteOpen(false); setInviteResult(null); }}>Done</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Invite team member</DialogTitle>
                                <DialogDescription>
                                    Enter their email and choose a role. A private invite link will be generated.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={inviteForm.handleSubmit(onInvite)} className="flex flex-col gap-4">
                                {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="invite-email">Email</Label>
                                    <Input
                                        id="invite-email"
                                        type="email"
                                        placeholder="colleague@example.com"
                                        {...inviteForm.register("email", { required: true })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Role</Label>
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="member">Member</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="owner">Owner</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" type="button" onClick={() => setInviteOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={inviteForm.formState.isSubmitting} className="gap-1.5">
                                        {inviteForm.formState.isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Generate link
                                    </Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
