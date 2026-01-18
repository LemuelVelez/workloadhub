/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
    LayoutDashboard,
    CalendarDays,
    Users,
    Settings,
    Clock,
    Database,
    DoorOpen,
    Scale,
    FileClock,
    UserCircle2,
    ClipboardList,
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

type RoleKey = "admin" | "chair" | "faculty" | "user"

type NavItem = {
    title: string
    href: string
    icon: React.ElementType
    roles?: RoleKey[] // if omitted => shown to everyone
}

type DashboardArea = "admin" | "chair" | "faculty" | null

function getAreaFromPath(pathname: string): DashboardArea {
    if (!pathname) return null
    if (pathname.startsWith("/dashboard/admin")) return "admin"

    // ✅ New Department Head area
    if (pathname.startsWith("/dashboard/department-head")) return "chair"

    // ✅ Backward compatibility (old chair route)
    if (pathname.startsWith("/dashboard/chair")) return "chair"

    if (pathname.startsWith("/dashboard/faculty")) return "faculty"
    return null
}

function getRoleFromUser(user: any): RoleKey {
    if (!user) return "user"

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

    pushIfString(prefs?.role)
    pushIfString(prefs?.userRole)
    pushIfString(user?.role)
    pushIfString(user?.userRole)
    pushIfString(user?.profile?.role)
    pushIfString(user?.profile?.userRole)
    pushIfString(user?.prefs?.role)
    pushIfString(user?.prefs?.userRole)

    const rolesFromPrefs = prefs?.roles
    if (Array.isArray(rolesFromPrefs)) {
        rolesFromPrefs.forEach((r: any) => pushIfString(r))
    } else if (typeof rolesFromPrefs === "string") {
        rolesFromPrefs
            .split(/[,\s]+/g)
            .filter(Boolean)
            .forEach((r) => candidates.push(r))
    }

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

    if (all.includes("superadmin") || all.includes("admin")) return "admin"
    if (all.includes("chair") || all.includes("department head") || all.includes("dept head")) return "chair"
    if (all.includes("faculty")) return "faculty"

    return "user"
}

function isOverviewRoute(pathname: string) {
    if (!pathname) return false
    if (pathname === "/dashboard") return true

    // ✅ Include department-head area
    return /^\/dashboard\/(admin|department-head|chair|faculty)\/overview\/?$/.test(pathname)
}

function isActivePath(currentPath: string, href: string) {
    if (!currentPath) return false

    if (href === "/dashboard") return isOverviewRoute(currentPath)

    return currentPath === href || currentPath.startsWith(href + "/")
}

export default function NavMain({ className }: { className?: string }) {
    const { pathname } = useLocation()
    const { user } = useSession()

    // ✅ store last area per-user (prevents admin sticky leaking to chair account)
    const userKey = String(user?.$id || user?.id || user?.userId || "anon").trim()
    const LAST_DASHBOARD_AREA_KEY = `workloadhub:lastDashboardArea:${userKey}`

    function safeGetLastArea(): DashboardArea {
        try {
            const v = window.sessionStorage.getItem(LAST_DASHBOARD_AREA_KEY)
            if (v === "admin" || v === "chair" || v === "faculty") return v
            return null
        } catch {
            return null
        }
    }

    function safeSetLastArea(area: DashboardArea) {
        try {
            if (!area) return
            window.sessionStorage.setItem(LAST_DASHBOARD_AREA_KEY, area)
        } catch {
            // ignore
        }
    }

    const areaFromPath = React.useMemo(() => getAreaFromPath(pathname), [pathname])
    const [stickyArea, setStickyArea] = React.useState<DashboardArea>(null)

    React.useEffect(() => {
        if (typeof window === "undefined") return

        if (areaFromPath) {
            safeSetLastArea(areaFromPath)
            setStickyArea(areaFromPath)
            return
        }

        const last = safeGetLastArea()
        setStickyArea(last)
    }, [areaFromPath])

    const effectiveArea = areaFromPath || stickyArea

    /**
     * ✅ FIX: Role fallback resolver
     * If user role is missing/unknown, infer from URL area.
     */
    const roleFromUser = React.useMemo(() => getRoleFromUser(user), [user])

    const role: RoleKey = React.useMemo(() => {
        if (roleFromUser !== "user") return roleFromUser
        if (effectiveArea === "admin") return "admin"
        if (effectiveArea === "chair") return "chair"
        if (effectiveArea === "faculty") return "faculty"
        return "user"
    }, [roleFromUser, effectiveArea])

    const adminMenu: NavItem[] = [
        {
            title: "Overview",
            href: "/dashboard/admin/overview",
            icon: LayoutDashboard,
            roles: ["admin"],
        },
        {
            title: "Schedules",
            href: "/dashboard/admin/schedules",
            icon: CalendarDays,
            roles: ["admin"],
        },
        {
            title: "Requests",
            href: "/dashboard/admin/requests",
            icon: Clock,
            roles: ["admin"],
        },
        {
            title: "Master Data",
            href: "/dashboard/admin/master-data-management",
            icon: Database,
            roles: ["admin"],
        },
        {
            title: "Academic Term Setup",
            href: "/dashboard/admin/academic-term-setup",
            icon: CalendarDays,
            roles: ["admin"],
        },
        {
            title: "Rooms & Facilities",
            href: "/dashboard/admin/rooms-and-facilities",
            icon: DoorOpen,
            roles: ["admin"],
        },
        {
            title: "Rules & Policies",
            href: "/dashboard/admin/rules-and-policies",
            icon: Scale,
            roles: ["admin"],
        },
        {
            title: "Users",
            href: "/dashboard/admin/users",
            icon: Users,
            roles: ["admin"],
        },
        {
            title: "Audit Logs",
            href: "/dashboard/admin/audit-logs",
            icon: FileClock,
            roles: ["admin"],
        },
    ]

    // ✅ Department Head (Chair) menu
    const chairMenu: NavItem[] = [
        {
            title: "Faculty Workload Assignment",
            href: "/dashboard/department-head/faculty-workload-assignment",
            icon: ClipboardList,
            roles: ["chair"],
        },
    ]

    // ✅ Faculty menu (so Faculty isn't empty)
    const facultyMenu: NavItem[] = [
        {
            title: "Overview",
            href: "/dashboard/faculty/overview",
            icon: LayoutDashboard,
            roles: ["faculty"],
        },
    ]

    /**
     * ✅ Preferences ALWAYS SHOW
     */
    const preferencesMenu: NavItem[] = [
        {
            title: "Account",
            href: "/dashboard/accounts",
            icon: UserCircle2,
        },
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

    const hasAdmin = adminMenu.filter(visible).length > 0
    const hasChair = chairMenu.filter(visible).length > 0
    const hasFaculty = facultyMenu.filter(visible).length > 0

    return (
        <div className={cn("min-w-0", className)}>
            {hasAdmin ? (
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

            {hasChair ? (
                <>
                    <SidebarGroup>
                        <SidebarGroupLabel>Department Head</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>{chairMenu.filter(visible).map(renderItem)}</SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarSeparator />
                </>
            ) : null}

            {hasFaculty ? (
                <>
                    <SidebarGroup>
                        <SidebarGroupLabel>Faculty</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>{facultyMenu.filter(visible).map(renderItem)}</SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarSeparator />
                </>
            ) : null}

            {/* ✅ ALWAYS SHOW PREFERENCES */}
            <SidebarGroup>
                <SidebarGroupLabel>Preferences</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>{preferencesMenu.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </div>
    )
}
