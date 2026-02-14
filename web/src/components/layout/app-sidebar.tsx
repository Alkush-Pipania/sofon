"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, LogOut } from "lucide-react";
import { tokenStore } from "@/service/api";

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

const navItems = [
    {
        title: "Monitoring",
        href: "/monitors",
        icon: Activity,
    },
    {
        title: "Incidents",
        href: "/incidents",
        icon: AlertTriangle,
    },
];

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
                <Link href="/monitors" className="text-2xl font-bold ">
                    Sofon
                </Link>
            </SidebarHeader>

            {/* Navigation */}
            <SidebarContent className="px-2 pt-2">
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
