"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, Users, UserCircle, LogOut, ChevronDown, Plus } from "lucide-react";
import { tokenStore } from "@/service/api";
import { useTeamStore, type Team } from "@/store/team-store";
import { useState } from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const navItems = [
    { title: "Monitoring", href: "/monitors", icon: Activity },
    { title: "Incidents", href: "/incidents", icon: AlertTriangle },
    { title: "Team", href: "/team", icon: Users },
    { title: "Profile", href: "/profile", icon: UserCircle },
];

function TeamSwitcher() {
    const { teams, currentTeam, setCurrentTeam, createTeam } = useTeamStore();
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
        } finally {
            setCreating(false);
        }
    };

    if (!currentTeam) return null;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                        <span className="truncate">{currentTeam.name}</span>
                        <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                    {teams.map((team: Team) => (
                        <DropdownMenuItem
                            key={team.id}
                            onClick={() => setCurrentTeam(team)}
                            className={team.id === currentTeam.id ? "bg-muted" : ""}
                        >
                            {team.name}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Create team
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Create a new team</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="Team name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = () => {
        tokenStore.clear();
        router.push("/signin");
    };

    return (
        <Sidebar className="border-r-0">
            {/* Brand */}
            <SidebarHeader className="h-14 border-b px-5 flex justify-end items-start">
                <Link href="/monitors" className="text-2xl font-bold">
                    Sofon
                </Link>
            </SidebarHeader>

            {/* Team switcher */}
            <div className="px-3 pt-3 pb-1">
                <TeamSwitcher />
            </div>

            <SidebarSeparator className="mx-3 mb-1" />

            {/* Navigation */}
            <SidebarContent className="px-2 pt-1">
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            tooltip={item.title}
                                            className={`h-10 rounded-lg px-3 text-sm font-medium transition-colors ${isActive
                                                ? "bg-[#3B8CF0]/10 text-[#3B8CF0] hover:bg-[#3B8CF0]/15"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                        >
                                            <Link href={item.href}>
                                                <item.icon className="h-[18px]! w-[18px]!" />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter className="px-2 pb-4">
                <SidebarSeparator className="mx-2 mb-2" />
                <SidebarMenu className="gap-1">
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Sign Out"
                            onClick={handleSignOut}
                            className="h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                            <LogOut className="h-[18px]! w-[18px]!" />
                            <span>Sign Out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
