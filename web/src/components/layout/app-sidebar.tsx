"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
    Activity, AlertTriangle, Users, UserCircle,
    LogOut, ChevronDown, Plus, Loader2, Check, Plug,
} from "lucide-react";
import { tokenStore } from "@/service/api";
import { useTeamStore, type Team } from "@/store/team-store";
import { useUserStore } from "@/store/user-store";
import { useState } from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── Nav groups ────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
    {
        label: "Monitor",
        items: [
            { title: "Monitors", href: "/monitors", icon: Activity },
            { title: "Incidents", href: "/incidents", icon: AlertTriangle },
        ],
    },
    {
        label: "Settings",
        items: [
            { title: "Team",    href: "/team",    icon: Users },
            { title: "Plugins", href: "/plugins", icon: Plug },
            { title: "Profile", href: "/profile", icon: UserCircle },
        ],
    },
];

// ── Team avatar (coloured initial) ───────────────────────────────────────────
const AVATAR_COLORS = [
    "#8b5cf6", "#3b82f6", "#10b981",
    "#f97316", "#f43f5e", "#06b6d4",
];

function teamColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function TeamAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
    const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-base";
    const color = teamColor(name);
    return (
        <span
            className={`${sz} inline-flex shrink-0 items-center justify-center rounded-2xl font-bold text-white`}
            style={{
                backgroundColor: "#0d0d0d",
                background: `radial-gradient(circle at center, ${color} 0%, transparent 75%)`,
            }}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

// ── Team switcher card + popover (always shown) ───────────────────────────────
function TeamSwitcher() {
    const { teams, currentTeam, setCurrentTeam, createTeam } = useTeamStore();
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await createTeam(newName.trim());
            setCreateOpen(false);
            setNewName("");
            setOpen(false);
        } finally {
            setCreating(false);
        }
    };

    const teamCard = (
        <button className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {currentTeam && <TeamAvatar name={currentTeam.name} />}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                    {currentTeam ? currentTeam.name : "No team"}
                </p>
                {currentTeam && (
                    <p className="text-xs text-muted-foreground">Organization</p>
                )}
            </div>
            {teams.length > 0 && <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
    );

    return (
        <>
            <Popover open={teams.length > 0 ? open : false} onOpenChange={teams.length > 0 ? setOpen : undefined}>
                <PopoverTrigger asChild>
                    {teamCard}
                </PopoverTrigger>

                {/* Popover panel */}
                <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={12}
                    className="w-64 p-2"
                >
                    {teams.length > 0 && (
                        <>
                            <p className="px-2 pb-1.5 pt-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Switch team
                            </p>
                            <div className="flex flex-col gap-0.5">
                                {teams.map((team: Team) => {
                                    const isActive = team.id === currentTeam?.id;
                                    return (
                                        <button
                                            key={team.id}
                                            onClick={() => { setCurrentTeam(team); setOpen(false); }}
                                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${isActive ? "bg-muted/60" : ""}`}
                                        >
                                            <TeamAvatar name={team.name} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{team.name}</p>
                                                <p className="text-xs text-muted-foreground">Organization</p>
                                            </div>
                                            {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="my-1.5 border-t border-border" />
                        </>
                    )}

                    {/* Create team button — always in the popover */}
                    <button
                        onClick={() => { setOpen(false); setCreateOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-border">
                            <Plus className="h-3.5 w-3.5" />
                        </span>
                        Create new team
                    </button>
                </PopoverContent>
            </Popover>

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
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        className="h-10 bg-white/5 border-white/10 focus-visible:ring-primary"
                        autoFocus
                    />
                    <DialogFooter className="pt-1">
                        <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            disabled={creating || !newName.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Create team
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { teams } = useTeamStore();
    const profile = useUserStore((s) => s.profile);
    const clearProfile = useUserStore((s) => s.clearProfile);
    const hasTeam = teams.length > 0;

    const handleSignOut = () => {
        tokenStore.clear();
        clearProfile();
        router.push("/signin");
    };

    return (
        <Sidebar className="border-r border-border">
            {/* Brand */}
            <SidebarHeader className="h-14 border-b border-border px-4">
                <Link href="/monitors" className="flex items-center gap-2.5">
                    <Image src="/sofon.png" alt="Sofon" width={30} height={30} className="rounded-lg" />
                    <span className="text-xl font-bold tracking-tight">Sofon</span>
                </Link>
            </SidebarHeader>

            <SidebarContent className="flex flex-col gap-0 px-3 py-4">

                {/* Team section */}
                <div className="mb-4">
                    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Organization
                    </p>
                    <TeamSwitcher />
                </div>

                {/* Nav groups */}
                {NAV_GROUPS.map((group) => (
                    <div key={group.label} className="mb-5">
                        <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                        </p>
                        <SidebarMenu className="gap-0.5">
                            {group.items.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                const accessible = item.href === "/profile" || hasTeam;

                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild={accessible}
                                            isActive={isActive && accessible}
                                            tooltip={accessible ? item.title : "Create a team first"}
                                            disabled={!accessible}
                                            className={`h-10 rounded-lg px-3 text-[15px] font-medium transition-colors
                                                ${!accessible
                                                    ? "cursor-not-allowed opacity-35"
                                                    : isActive
                                                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                                                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                                                }`}
                                        >
                                            {accessible ? (
                                                <Link href={item.href} className="flex items-center gap-3">
                                                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                                                    <span>{item.title}</span>
                                                </Link>
                                            ) : (
                                                <span className="flex items-center gap-3">
                                                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                                                    <span>{item.title}</span>
                                                </span>
                                            )}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </div>
                ))}
            </SidebarContent>

            {/* Footer — user info + sign out */}
            <SidebarFooter className="border-t border-border px-3 py-3">
                {/* User card */}
                {profile && (
                    <div className="px-2 py-2.5 mb-1">
                        <p className="truncate text-sm font-medium leading-tight">{profile.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                )}
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={handleSignOut}
                            tooltip="Sign Out"
                            className="h-10 rounded-lg px-3 text-[15px] font-medium text-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                            <LogOut className="h-[18px] w-[18px] shrink-0" />
                            <span>Sign Out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
