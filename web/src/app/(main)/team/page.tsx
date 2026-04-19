"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Copy, Check, Loader2, MoreHorizontal, UserPlus, UserX, UserCheck } from "lucide-react";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { get, put, post, del, patch } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";

// ── Types ──────────────────────────────────────────────────────
interface TeamResponse { success: boolean; data: { name: string } }
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
const roleBadgeClass: Record<string, string> = {
    owner:  "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    admin:  "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    member: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
};

function RoleBadge({ role }: { role: string }) {
    return (
        <Badge variant="outline" className={`capitalize ${roleBadgeClass[role] ?? ""}`}>
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
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
    );
}

// ── Page ───────────────────────────────────────────────────────
export default function TeamPage() {
    const [teamName, setTeamName] = useState("");
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
        setLoading(true);
        try {
            const [t, m, i, profile] = await Promise.all([
                get<TeamResponse>(ENDPOINTS.TEAM.GET),
                get<MemberResponse>(ENDPOINTS.TEAM.MEMBERS),
                get<InvitationsResponse>(ENDPOINTS.TEAM.INVITATIONS),
                get<{ success: boolean; data: { id: string; role: string } }>(ENDPOINTS.USERS.ME),
            ]);
            setTeamName(t.data.name);
            nameForm.reset({ name: t.data.name });
            setMembers(m.data ?? []);
            setMe({ id: profile.data.id, role: profile.data.role });
            setInvitations((i.data ?? []).filter((inv) => !inv.accepted));
        } catch {
            // silently fail — table will show empty
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const onSaveName = async (data: TeamNameForm) => {
        setNameError(null);
        setSavingName(true);
        try {
            await put(ENDPOINTS.TEAM.UPDATE, { name: data.name });
            setTeamName(data.name);
        } catch (err) {
            setNameError(parseApiError(err, "Failed to update team name."));
        } finally {
            setSavingName(false);
        }
    };

    const onInvite = async (data: InviteForm) => {
        setInviteError(null);
        try {
            const res = await post<{ success: boolean; data: Invitation }>(
                ENDPOINTS.TEAM.INVITATIONS,
                { email: data.email, role: inviteRole },
            );
            setInviteResult(res.data);
            setInvitations((prev) => [res.data, ...prev]);
            inviteForm.reset();
        } catch (err) {
            setInviteError(parseApiError(err, "Failed to create invitation."));
        }
    };

    const setMemberActive = async (id: string, active: boolean) => {
        setUpdatingMember(id);
        try {
            await patch(ENDPOINTS.TEAM.SET_MEMBER_ACTIVE(id), { active });
            setMembers((prev) => prev.map((m) => m.id === id ? { ...m, is_active: active } : m));
        } catch {
            // ignore
        } finally {
            setUpdatingMember(null);
            setConfirmMember(null);
        }
    };

    const revokeInvitation = async (id: string) => {
        setRevoking(id);
        try {
            await del(ENDPOINTS.TEAM.REVOKE_INVITATION(id));
            setInvitations((prev) => prev.filter((i) => i.id !== id));
        } catch {
            // ignore
        } finally {
            setRevoking(null);
        }
    };

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
                <h1 className="text-2xl font-bold tracking-tight">Team</h1>
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
                <TabsContent value="members" className="mt-6 space-y-6">

                    {/* Members table */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle className="text-base">Members</CardTitle>
                                <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
                            </div>
                            <Button size="sm" className="gap-1.5" onClick={() => { setInviteResult(null); setInviteOpen(true); }}>
                                <UserPlus className="h-3.5 w-3.5" />
                                Invite
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-6">Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="w-14">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {members.map((m) => (
                                        <TableRow key={m.id} className={!m.is_active ? "opacity-50" : ""}>
                                            <TableCell className="pl-6 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {m.name}
                                                    {me?.id === m.id && (
                                                        <Badge variant="outline" className="text-xs px-1.5 py-0 border-zinc-400/40 text-zinc-400">
                                                            you
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{m.email}</TableCell>
                                            <TableCell><RoleBadge role={m.role} /></TableCell>
                                            <TableCell>
                                                {m.is_active ? (
                                                    <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                        </span>
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-500">
                                                        Deactivated
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="pr-4">
                                                {updatingMember === m.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                ) : (
                                                    me?.id !== m.id &&
                                                    !(m.role === "owner" && me?.role !== "owner") && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                                                                    <DropdownMenuItem
                                                                        onClick={() => setMemberActive(m.id, true)}
                                                                    >
                                                                        <UserCheck className="mr-2 h-3.5 w-3.5" />
                                                                        Activate
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Pending invitations */}
                    {invitations.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Pending invitations</CardTitle>
                                <CardDescription>Invitations that haven't been accepted yet.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-6">Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Expires</TableHead>
                                            <TableHead>Link</TableHead>
                                            <TableHead className="w-12" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invitations.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="pl-6 text-muted-foreground">{inv.email}</TableCell>
                                                <TableCell><RoleBadge role={inv.role} /></TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(inv.expires_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="max-w-[220px]">
                                                    <div className="flex min-w-0 items-center gap-1">
                                                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                                                            {inv.link}
                                                        </span>
                                                        <CopyButton text={inv.link} />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-4">
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
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
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
                            {" "}will lose access immediately. Their data is preserved and you can reactivate them later.
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
