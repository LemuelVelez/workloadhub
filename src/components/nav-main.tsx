/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    Users,
    Building2,
    Layers,
    FileText,
    ShieldCheck,
    Settings,
    Clock,
} from "lucide-react"

import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar"

type RoleKey = "admin" | "scheduler" | "faculty" | "reviewer" | "uploader" | "user"

type NavItem = {
    title: string
    href: string
    icon: React.ElementType
    roles?: RoleKey[] // if omitted => shown to everyone
}

function getRole(user: any): RoleKey {
    // ✅ Try common places where role might exist (Appwrite prefs, labels, etc.)
    const prefRole =
        user?.prefs?.role ||
        user?.prefs?.userRole ||
        user?.role ||
        user?.userRole ||
        null

    const labels: string[] = Array.isArray(user?.labels) ? user.labels : []
    const roles: string[] = Array.isArray(user?.prefs?.roles) ? user.prefs.roles : []

    const haystack = String(prefRole || "").toLowerCase()

    // ✅ Look through roles/labels for known role keywords
    const all = [haystack, ...labels.map(String), ...roles.map(String)]
        .join(" ")
        .toLowerCase()

    if (all.includes("admin")) return "admin"
    if (all.includes("scheduler")) return "scheduler"
    if (all.includes("faculty")) return "faculty"
    if (all.includes("reviewer")) return "reviewer"
    if (all.includes("uploader")) return "uploader"

    return "user"
}

function isActivePath(currentPath: string, href: string) {
    if (!currentPath) return false
    if (href === "/dashboard") return currentPath === "/dashboard"
    return currentPath.startsWith(href)
}

export default function NavMain({ className }: { className?: string }) {
    const { pathname } = useLocation()
    const { user } = useSession()

    const role = getRole(user)

    const primary: NavItem[] = [
        {
            title: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Schedules",
            href: "/dashboard/schedules",
            icon: CalendarDays,
            roles: ["admin", "scheduler"],
        },
        {
            title: "My Workload",
            href: "/dashboard/workload",
            icon: ClipboardList,
            roles: ["faculty"],
        },
        {
            title: "Requests",
            href: "/dashboard/requests",
            icon: Clock,
            roles: ["admin", "scheduler", "faculty"],
        },
    ]

    const management: NavItem[] = [
        {
            title: "Departments",
            href: "/dashboard/departments",
            icon: Building2,
            roles: ["admin"],
        },
        {
            title: "Users",
            href: "/dashboard/users",
            icon: Users,
            roles: ["admin"],
        },
        {
            title: "Templates",
            href: "/dashboard/templates",
            icon: Layers,
            roles: ["admin", "reviewer"],
        },
        {
            title: "Reports",
            href: "/dashboard/reports",
            icon: FileText,
            roles: ["admin", "scheduler"],
        },
        {
            title: "Audit Logs",
            href: "/dashboard/audit",
            icon: ShieldCheck,
            roles: ["admin"],
        },
    ]

    const settings: NavItem[] = [
        {
            title: "Settings",
            href: "/dashboard/settings",
            icon: Settings,
        },
    ]

    const visible = (it: NavItem) => {
        if (!it.roles || it.roles.length === 0) return true
        return it.roles.includes(role)
    }

    const renderItem = (it: NavItem) => {
        const active = isActivePath(pathname, it.href)
        const Icon = it.icon

        return (
            <SidebarMenuItem key={it.href}>
                <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={it.title}
                    className={cn(active && "font-medium")}
                >
                    <Link to={it.href} className="min-w-0">
                        <Icon />
                        <span className="truncate">{it.title}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        )
    }

    return (
        <div className={cn("min-w-0", className)}>
            <SidebarGroup>
                <SidebarGroupLabel>Overview</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {primary.filter(visible).map(renderItem)}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
                <SidebarGroupLabel>Management</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {management.filter(visible).map(renderItem)}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
                <SidebarGroupLabel>Preferences</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {settings.filter(visible).map(renderItem)}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </div>
    )
}
