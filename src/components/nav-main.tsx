/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    Users,
    Settings,
    Clock,
    Database,
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

/**
 * ✅ Very tolerant role resolver
 * - supports: user.prefs.role, user.role, user.userRole, user.profile.role
 * - supports: prefs stored as JSON string
 * - supports: roles as string OR array
 * - supports uppercase like "ADMIN"
 */
function getRole(user: any): RoleKey {
    if (!user) return "user"

    // prefs can sometimes be JSON string depending on how session is built
    let prefs: any = user?.prefs ?? {}
    if (typeof prefs === "string") {
        try {
            prefs = JSON.parse(prefs)
        } catch {
            prefs = {}
        }
    }

    const candidates: string[] = []

    const pushIfString = (v: any) => {
        if (typeof v === "string" && v.trim()) candidates.push(v.trim())
    }

    // common fields
    pushIfString(prefs?.role)
    pushIfString(prefs?.userRole)
    pushIfString(user?.role)
    pushIfString(user?.userRole)
    pushIfString(user?.profile?.role)
    pushIfString(user?.profile?.userRole)
    pushIfString(user?.prefs?.role)
    pushIfString(user?.prefs?.userRole)

    // roles can be array OR string
    const rolesFromPrefs = prefs?.roles
    if (Array.isArray(rolesFromPrefs)) {
        rolesFromPrefs.forEach((r: any) => pushIfString(r))
    } else if (typeof rolesFromPrefs === "string") {
        rolesFromPrefs
            .split(/[,\s]+/g)
            .filter(Boolean)
            .forEach((r) => candidates.push(r))
    }

    // labels can be array OR string
    const labels = user?.labels
    if (Array.isArray(labels)) {
        labels.forEach((l: any) => pushIfString(l))
    } else if (typeof labels === "string") {
        labels
            .split(/[,\s]+/g)
            .filter(Boolean)
            .forEach((l) => candidates.push(l))
    }

    const all = candidates.join(" ").toLowerCase()

    // ✅ normalize matching (supports ADMIN, superadmin, etc.)
    if (all.includes("superadmin") || all.includes("admin")) return "admin"
    if (all.includes("scheduler")) return "scheduler"
    if (all.includes("faculty")) return "faculty"
    if (all.includes("reviewer")) return "reviewer"
    if (all.includes("uploader")) return "uploader"

    return "user"
}

/**
 * ✅ Overview route matcher
 * We want Overview active ONLY on actual overview screens:
 * - /dashboard (index redirect)
 * - /dashboard/admin/overview
 * - /dashboard/chair/overview
 * - /dashboard/faculty/overview
 * - etc.
 */
function isOverviewRoute(pathname: string) {
    if (!pathname) return false
    if (pathname === "/dashboard") return true

    return /^\/dashboard\/(admin|chair|faculty|scheduler|reviewer|uploader)\/overview\/?$/.test(
        pathname
    )
}

/**
 * ✅ Active path logic
 * - Overview (/dashboard) should NOT be active everywhere
 * - Other routes can use startsWith
 */
function isActivePath(currentPath: string, href: string) {
    if (!currentPath) return false

    // Overview special-case
    if (href === "/dashboard") return isOverviewRoute(currentPath)

    // Normal behavior
    return currentPath === href || currentPath.startsWith(href + "/")
}

export default function NavMain({ className }: { className?: string }) {
    const { pathname } = useLocation()
    const { user } = useSession()

    const role = getRole(user)

    // ✅ If you're in admin routes, keep admin menu visible (even if role detection fails)
    const inAdminArea = pathname.startsWith("/dashboard/admin")

    /**
     * ✅ MAIN NAV
     * IMPORTANT:
     * - "Overview" is the only home link now
     * - It points to /dashboard, App.tsx redirects by role
     * - This removes duplicate Dashboard/Overview indicators
     */
    const primary: NavItem[] = [
        {
            title: "Overview",
            href: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Requests",
            href: "/dashboard/requests",
            icon: Clock,
            roles: ["admin", "scheduler", "faculty"],
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
    ]

    /**
     * ✅ ADMIN MENU (matches App.tsx)
     */
    const adminMenu: NavItem[] = [
        {
            title: "Master Data",
            href: "/dashboard/admin/master-data-management",
            icon: Database,
            roles: ["admin"],
        },
        {
            title: "Users",
            href: "/dashboard/admin/users",
            icon: Users,
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

        // ✅ Force admin group to appear if currently inside /dashboard/admin/*
        if (inAdminArea && it.roles.includes("admin")) return true

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
            {/* ✅ Main */}
            <SidebarGroup>
                <SidebarGroupLabel>Main</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>{primary.filter(visible).map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            {/* ✅ Admin */}
            {adminMenu.filter(visible).length > 0 ? (
                <>
                    <SidebarGroup>
                        <SidebarGroupLabel>Admin</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>{adminMenu.filter(visible).map(renderItem)}</SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarSeparator />
                </>
            ) : null}

            {/* ✅ Preferences */}
            <SidebarGroup>
                <SidebarGroupLabel>Preferences</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>{settings.filter(visible).map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </div>
    )
}
