/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useLocation, useNavigate, Link } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { NavUser } from "@/components/nav-user"
import { useSession } from "@/hooks/use-session"

import { cn } from "@/lib/utils"
import { databases, DATABASE_ID, COLLECTIONS, Query } from "@/lib/db"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

export type DashboardHeaderProps = {
    title?: string
    subtitle?: string
    actions?: React.ReactNode
    className?: string
}

type RoleKey = "admin" | "scheduler" | "faculty" | "chair" | "dean" | "user"

type SearchItemType =
    | "page"
    | "department"
    | "program"
    | "subject"
    | "room"
    | "academic_term"
    | "time_block"
    | "user"
    | "faculty"
    | "section"
    | "schedule_version"
    | "class"
    | "meeting"
    | "availability"
    | "request"
    | "notification"
    | "audit"

type SearchItem = {
    type: SearchItemType
    id: string
    title: string
    subtitle?: string
    href: string
}

function titleFromPath(pathname: string) {
    const p = (pathname ?? "").split("?")[0] ?? ""
    if (!p.startsWith("/dashboard")) return "Dashboard"

    const parts = p.split("/").filter(Boolean)
    const pretty = parts
        .slice(1)
        .map((s) => s.replace(/-/g, " "))
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))

    if (!pretty.length) return "Dashboard"
    return pretty.join(" • ")
}

function typeLabel(t: SearchItemType) {
    if (t === "page") return "Pages"
    if (t === "department") return "Departments"
    if (t === "program") return "Programs"
    if (t === "subject") return "Subjects"
    if (t === "room") return "Rooms"
    if (t === "academic_term") return "Academic Terms"
    if (t === "time_block") return "Time Blocks"
    if (t === "user") return "Users"
    if (t === "faculty") return "Faculty Profiles"
    if (t === "section") return "Sections"
    if (t === "schedule_version") return "Schedule Versions"
    if (t === "class") return "Classes"
    if (t === "meeting") return "Class Meetings"
    if (t === "availability") return "Faculty Availability"
    if (t === "request") return "Change Requests"
    if (t === "notification") return "Notifications"
    return "Audit Logs"
}

function typeBadge(t: SearchItemType) {
    if (t === "page") return "Page"
    if (t === "department") return "Department"
    if (t === "program") return "Program"
    if (t === "subject") return "Subject"
    if (t === "room") return "Room"
    if (t === "academic_term") return "Term"
    if (t === "time_block") return "Time"
    if (t === "user") return "User"
    if (t === "faculty") return "Faculty"
    if (t === "section") return "Section"
    if (t === "schedule_version") return "Version"
    if (t === "class") return "Class"
    if (t === "meeting") return "Meeting"
    if (t === "availability") return "Availability"
    if (t === "request") return "Request"
    if (t === "notification") return "Notif"
    return "Audit"
}

function safeParsePrefs(prefs: any) {
    if (!prefs) return {}
    if (typeof prefs === "string") {
        try {
            const parsed = JSON.parse(prefs)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
            return {}
        }
    }
    if (typeof prefs === "object") return prefs
    return {}
}

/**
 * ✅ Tolerant Role Resolver
 */
function getRole(user: any): RoleKey {
    if (!user) return "user"

    const rawPrefs =
        user?.prefs ??
        user?.preferences ??
        user?.profile?.prefs ??
        user?.profile?.preferences ??
        user?.data?.prefs ??
        user?.data?.preferences ??
        {}

    const prefs = safeParsePrefs(rawPrefs)

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
    if (all.includes("scheduler")) return "scheduler"
    if (all.includes("faculty")) return "faculty"
    if (all.includes("chair")) return "chair"
    if (all.includes("dean")) return "dean"

    return "user"
}

function resolveUserId(user: any) {
    return String(user?.$id || user?.id || user?.userId || "").trim()
}

function roleBase(role: RoleKey) {
    // ✅ current app only has /dashboard/admin pages
    // ✅ scheduler/chair/dean can still be routed there if allowed by visibility filter
    if (role === "admin" || role === "scheduler" || role === "chair" || role === "dean") {
        return "/dashboard/admin"
    }
    return "/dashboard"
}

/**
 * ✅ Role-Based Visibility (FIXED TS2367)
 */
function isTypeVisibleForRole(type: SearchItemType, role: RoleKey) {
    if (type === "page") return true
    if (role === "admin") return true

    if (role === "scheduler") {
        return (
            type === "department" ||
            type === "program" ||
            type === "subject" ||
            type === "room" ||
            type === "academic_term" ||
            type === "time_block" ||
            type === "section" ||
            type === "schedule_version" ||
            type === "class" ||
            type === "meeting" ||
            type === "request" ||
            type === "notification"
        )
    }

    if (role === "faculty") {
        return (
            type === "class" ||
            type === "meeting" ||
            type === "availability" ||
            type === "academic_term" ||
            type === "time_block" ||
            type === "notification"
        )
    }

    if (role === "chair" || role === "dean") {
        return (
            type === "department" ||
            type === "program" ||
            type === "subject" ||
            type === "section" ||
            type === "schedule_version" ||
            type === "class" ||
            type === "request" ||
            type === "notification"
        )
    }

    return type === "notification"
}

function appendQuery(href: string, params: Record<string, string | undefined>) {
    const [path, qs] = href.split("?")
    const sp = new URLSearchParams(qs ?? "")
    Object.entries(params).forEach(([k, v]) => {
        if (!v) return
        sp.set(k, v)
    })
    const out = sp.toString()
    return out ? `${path}?${out}` : path
}

/**
 * ✅ Redirect to SOURCE PAGES (role-aware)
 * ✅ Also injects focusType + focusId so target pages can auto-open + highlight record.
 */
function hrefForItem(type: SearchItemType, id: string, role: RoleKey) {
    const base = roleBase(role)

    // Notifications:
    // - privileged roles -> admin overview focus
    // - normal users -> dashboard home
    if (type === "notification") {
        if (base === "/dashboard/admin") {
            return appendQuery(`${base}/overview`, {
                focusType: "notification",
                focusId: id,
                notificationId: id,
            })
        }
        return "/dashboard"
    }

    // Admin-only entity pages fallback
    if (base !== "/dashboard/admin") return "/dashboard"

    if (type === "department") {
        return appendQuery(`${base}/master-data-management`, {
            tab: "departments",
            focusType: "department",
            focusId: id,
            id,
        })
    }

    if (type === "program") {
        return appendQuery(`${base}/master-data-management`, {
            tab: "programs",
            focusType: "program",
            focusId: id,
            id,
        })
    }

    if (type === "subject") {
        return appendQuery(`${base}/master-data-management`, {
            tab: "subjects",
            focusType: "subject",
            focusId: id,
            id,
        })
    }

    if (type === "room") {
        return appendQuery(`${base}/rooms-and-facilities`, {
            focusType: "room",
            focusId: id,
            roomId: id,
        })
    }

    if (type === "academic_term") {
        return appendQuery(`${base}/academic-term-setup`, {
            focusType: "academic_term",
            focusId: id,
            termId: id,
        })
    }

    if (type === "time_block") {
        return appendQuery(`${base}/academic-term-setup`, {
            focusType: "time_block",
            focusId: id,
            timeBlockId: id,
        })
    }

    if (type === "user") {
        return appendQuery(`${base}/users`, {
            focusType: "user",
            focusId: id,
            userId: id,
        })
    }

    if (type === "faculty") {
        return appendQuery(`${base}/users`, {
            focusType: "faculty",
            focusId: id,
            facultyUserId: id,
        })
    }

    if (type === "section") {
        return appendQuery(`${base}/schedules`, {
            focusType: "section",
            focusId: id,
            sectionId: id,
        })
    }

    if (type === "schedule_version") {
        return appendQuery(`${base}/schedules`, {
            focusType: "schedule_version",
            focusId: id,
            versionId: id,
        })
    }

    if (type === "class") {
        return appendQuery(`${base}/schedules`, {
            focusType: "class",
            focusId: id,
            classId: id,
        })
    }

    if (type === "meeting") {
        return appendQuery(`${base}/schedules`, {
            focusType: "meeting",
            focusId: id,
            meetingId: id,
        })
    }

    if (type === "availability") {
        return appendQuery(`${base}/schedules`, {
            focusType: "availability",
            focusId: id,
            availabilityId: id,
        })
    }

    if (type === "request") {
        return appendQuery(`${base}/requests`, {
            focusType: "request",
            focusId: id,
            requestId: id,
        })
    }

    if (type === "audit") {
        return appendQuery(`${base}/audit-logs`, {
            focusType: "audit",
            focusId: id,
            auditId: id,
        })
    }

    return "/dashboard"
}

/**
 * ✅ Local Page Search
 */
type PageItem = SearchItem & { roles?: RoleKey[]; keywords?: string[] }

function normalizeText(s: string) {
    return (s ?? "").toLowerCase().trim()
}

function scorePageItem(item: PageItem, q: string) {
    const query = normalizeText(q)
    if (!query) return 0

    const title = normalizeText(item.title)
    const sub = normalizeText(item.subtitle ?? "")
    const keys = (item.keywords ?? []).map((k) => normalizeText(k)).join(" ")

    let score = 0
    if (title === query) score += 100
    if (title.startsWith(query)) score += 50
    if (title.includes(query)) score += 25
    if (sub.includes(query)) score += 10
    if (keys.includes(query)) score += 8

    const tokens = query.split(/\s+/g).filter(Boolean)
    for (const t of tokens) {
        if (t.length < 2) continue
        if (title.includes(t)) score += 4
        if (sub.includes(t)) score += 2
        if (keys.includes(t)) score += 1
    }

    return score
}

function buildPageCatalog(): PageItem[] {
    return [
        {
            type: "page",
            id: "dashboard",
            title: "Dashboard",
            subtitle: "Go to dashboard home",
            href: "/dashboard",
            roles: ["admin", "scheduler", "faculty", "chair", "dean", "user"],
            keywords: ["home", "overview"],
        },
        {
            type: "page",
            id: "settings",
            title: "Settings",
            subtitle: "App preferences",
            href: "/dashboard/settings",
            roles: ["admin", "scheduler", "faculty", "chair", "dean", "user"],
            keywords: ["preferences", "config"],
        },

        // Admin
        {
            type: "page",
            id: "admin_overview",
            title: "Admin Overview",
            subtitle: "System overview",
            href: "/dashboard/admin/overview",
            roles: ["admin"],
            keywords: ["summary", "status"],
        },
        {
            type: "page",
            id: "admin_schedules",
            title: "Schedules",
            subtitle: "Manage schedules",
            href: "/dashboard/admin/schedules",
            roles: ["admin", "scheduler"],
            keywords: ["classes", "timetable"],
        },
        {
            type: "page",
            id: "admin_requests",
            title: "Requests",
            subtitle: "Manage change requests",
            href: "/dashboard/admin/requests",
            roles: ["admin", "scheduler", "chair", "dean"],
            keywords: ["pending", "approval"],
        },
        {
            type: "page",
            id: "admin_mdm",
            title: "Master Data",
            subtitle: "Departments, programs, subjects",
            href: "/dashboard/admin/master-data-management",
            roles: ["admin", "scheduler"],
            keywords: ["departments", "programs", "subjects", "mdm"],
        },
        {
            type: "page",
            id: "admin_terms",
            title: "Academic Term Setup",
            subtitle: "Configure terms and time blocks",
            href: "/dashboard/admin/academic-term-setup",
            roles: ["admin", "scheduler"],
            keywords: ["term", "semester", "time blocks"],
        },
        {
            type: "page",
            id: "admin_rooms",
            title: "Rooms & Facilities",
            subtitle: "Manage rooms",
            href: "/dashboard/admin/rooms-and-facilities",
            roles: ["admin", "scheduler"],
            keywords: ["rooms", "facilities"],
        },
        {
            type: "page",
            id: "admin_rules",
            title: "Rules & Policies",
            subtitle: "System rules",
            href: "/dashboard/admin/rules-and-policies",
            roles: ["admin"],
            keywords: ["policies", "rules"],
        },
        {
            type: "page",
            id: "admin_users",
            title: "Users",
            subtitle: "Manage user accounts",
            href: "/dashboard/admin/users",
            roles: ["admin"],
            keywords: ["accounts", "roles"],
        },
        {
            type: "page",
            id: "admin_audit",
            title: "Audit Logs",
            subtitle: "System logs",
            href: "/dashboard/admin/audit-logs",
            roles: ["admin"],
            keywords: ["history", "logs"],
        },
    ]
}

function canSeePageForRole(item: PageItem, role: RoleKey) {
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.includes(role)
}

function localPageSearch(
    catalog: PageItem[],
    role: RoleKey,
    q: string,
    limit = 6
): SearchItem[] {
    const query = q.trim()
    if (query.length < 2) return []

    const visible = catalog.filter((it) => canSeePageForRole(it, role))

    return visible
        .map((it) => ({ it, score: scorePageItem(it, query) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => ({
            type: x.it.type,
            id: x.it.id,
            title: x.it.title,
            subtitle: x.it.subtitle,
            href: x.it.href,
        }))
}

/**
 * ✅ Appwrite Search Helpers
 */
type SearchSpec = {
    type: SearchItemType
    collectionId: string
    fields: string[]
    roles: RoleKey[]
    buildExtraQueries?: (ctx: { role: RoleKey; userId: string }) => any[]
    toItem: (doc: any, ctx: { role: RoleKey }) => SearchItem
}

async function listDocumentsTry(collectionId: string, tryQueries: any[]): Promise<any[]> {
    try {
        const res = await databases.listDocuments(DATABASE_ID, collectionId, tryQueries)
        return (res as any)?.documents ?? []
    } catch {
        return []
    }
}

async function searchByFields(
    collectionId: string,
    fields: string[],
    q: string,
    limit: number,
    extraQueries: any[] = []
) {
    const trimmed = q.trim()
    if (!trimmed) return []

    // 1) fulltext
    for (const f of fields) {
        const docs = await listDocumentsTry(collectionId, [
            Query.search(f, trimmed),
            Query.limit(limit),
            ...extraQueries,
        ])
        if (docs.length > 0) return docs
    }

    // 2) startsWith fallback
    for (const f of fields) {
        const docs = await listDocumentsTry(collectionId, [
            Query.startsWith(f, trimmed),
            Query.limit(limit),
            ...extraQueries,
        ])
        if (docs.length > 0) return docs
    }

    return []
}

function dedupeItems(arr: SearchItem[]) {
    const seen = new Set<string>()
    const out: SearchItem[] = []
    for (const it of arr) {
        const key = `${it.type}:${it.id}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(it)
    }
    return out
}

export default function DashboardHeader({
    title,
    subtitle,
    actions,
    className,
}: DashboardHeaderProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useSession()

    const pathname = location.pathname ?? ""
    const derivedTitle = title ?? titleFromPath(pathname)

    const role = React.useMemo(() => getRole(user), [user])
    const userId = React.useMemo(() => resolveUserId(user), [user])

    const [q, setQ] = React.useState("")
    const [open, setOpen] = React.useState(false)
    const [mobileOpen, setMobileOpen] = React.useState(false)
    const [items, setItems] = React.useState<SearchItem[]>([])
    const [loading, setLoading] = React.useState(false)

    const pageCatalog = React.useMemo(() => buildPageCatalog(), [])

    const debounceRef = React.useRef<number | null>(null)
    const seqRef = React.useRef(0)

    const searchSpecs = React.useMemo<SearchSpec[]>(() => {
        return [
            {
                type: "department",
                collectionId: COLLECTIONS.DEPARTMENTS,
                fields: ["name", "code"],
                roles: ["admin", "scheduler", "chair", "dean"],
                toItem: (d, ctx) => ({
                    type: "department",
                    id: d.$id,
                    title: `${d.code ?? ""}${d.code ? " — " : ""}${d.name ?? "Department"}`,
                    subtitle: d.isActive === false ? "Inactive" : undefined,
                    href: hrefForItem("department", d.$id, ctx.role),
                }),
            },
            {
                type: "program",
                collectionId: COLLECTIONS.PROGRAMS,
                fields: ["name", "code"],
                roles: ["admin", "scheduler", "chair", "dean"],
                toItem: (d, ctx) => ({
                    type: "program",
                    id: d.$id,
                    title: `${d.code ?? ""}${d.code ? " — " : ""}${d.name ?? "Program"}`,
                    subtitle: d.departmentId ? `Department: ${d.departmentId}` : undefined,
                    href: hrefForItem("program", d.$id, ctx.role),
                }),
            },
            {
                type: "subject",
                collectionId: COLLECTIONS.SUBJECTS,
                fields: ["title", "code"],
                roles: ["admin", "scheduler", "chair", "dean"],
                toItem: (d, ctx) => ({
                    type: "subject",
                    id: d.$id,
                    title: `${d.code ?? ""}${d.code ? " — " : ""}${d.title ?? "Subject"}`,
                    subtitle:
                        typeof d.units === "number"
                            ? `Units: ${d.units}`
                            : d.departmentId
                                ? `Department: ${d.departmentId}`
                                : undefined,
                    href: hrefForItem("subject", d.$id, ctx.role),
                }),
            },
            {
                type: "room",
                collectionId: COLLECTIONS.ROOMS,
                fields: ["name", "code", "building"],
                roles: ["admin", "scheduler"],
                toItem: (d, ctx) => ({
                    type: "room",
                    id: d.$id,
                    title: `${d.code ?? ""}${d.code ? " — " : ""}${d.name ?? "Room"}`,
                    subtitle: d.building ? `Building: ${d.building}` : undefined,
                    href: hrefForItem("room", d.$id, ctx.role),
                }),
            },

            {
                type: "academic_term",
                collectionId: COLLECTIONS.ACADEMIC_TERMS,
                fields: ["schoolYear", "semester"],
                roles: ["admin", "scheduler", "chair", "dean", "faculty"],
                toItem: (d, ctx) => ({
                    type: "academic_term",
                    id: d.$id,
                    title: `${d.schoolYear ?? "SY"} • ${d.semester ?? "Semester"}`,
                    subtitle:
                        d.startDate && d.endDate
                            ? `${d.startDate} → ${d.endDate}`
                            : d.isActive
                                ? "Active"
                                : "Inactive",
                    href: hrefForItem("academic_term", d.$id, ctx.role),
                }),
            },
            {
                type: "time_block",
                collectionId: COLLECTIONS.TIME_BLOCKS,
                fields: ["label", "dayOfWeek"],
                roles: ["admin", "scheduler", "faculty"],
                toItem: (d, ctx) => ({
                    type: "time_block",
                    id: d.$id,
                    title:
                        d.label ??
                        `${d.dayOfWeek ?? "Day"} • ${d.startTime ?? ""}-${d.endTime ?? ""}`,
                    subtitle: d.termId ? `Term: ${d.termId}` : undefined,
                    href: hrefForItem("time_block", d.$id, ctx.role),
                }),
            },

            {
                type: "user",
                collectionId: COLLECTIONS.USER_PROFILES,
                fields: ["name", "email", "role"],
                roles: ["admin"],
                toItem: (d, ctx) => ({
                    type: "user",
                    id: d.$id,
                    title: d.name ?? d.email ?? "User",
                    subtitle: `${d.email ?? ""}${d.role ? ` • ${d.role}` : ""}`,
                    href: hrefForItem("user", d.$id, ctx.role),
                }),
            },
            {
                type: "faculty",
                collectionId: COLLECTIONS.FACULTY_PROFILES,
                fields: ["employeeNo", "rank", "notes"],
                roles: ["admin"],
                toItem: (d, ctx) => ({
                    type: "faculty",
                    id: d.$id,
                    title: d.employeeNo ? `Faculty • ${d.employeeNo}` : "Faculty Profile",
                    subtitle: d.rank ? `Rank: ${d.rank}` : undefined,
                    href: hrefForItem("faculty", d.$id, ctx.role),
                }),
            },

            {
                type: "section",
                collectionId: COLLECTIONS.SECTIONS,
                fields: ["name"],
                roles: ["admin", "scheduler", "chair", "dean"],
                toItem: (d, ctx) => ({
                    type: "section",
                    id: d.$id,
                    title: d.name ?? "Section",
                    subtitle:
                        typeof d.yearLevel === "number"
                            ? `Year Level: ${d.yearLevel}`
                            : d.termId
                                ? `Term: ${d.termId}`
                                : undefined,
                    href: hrefForItem("section", d.$id, ctx.role),
                }),
            },
            {
                type: "schedule_version",
                collectionId: COLLECTIONS.SCHEDULE_VERSIONS,
                fields: ["label", "status"],
                roles: ["admin", "scheduler", "chair", "dean"],
                toItem: (d, ctx) => ({
                    type: "schedule_version",
                    id: d.$id,
                    title: d.label ?? `Version ${d.version ?? ""}`,
                    subtitle: d.status ? `Status: ${d.status}` : undefined,
                    href: hrefForItem("schedule_version", d.$id, ctx.role),
                }),
            },
            {
                type: "class",
                collectionId: COLLECTIONS.CLASSES,
                fields: ["classCode", "remarks", "status"],
                roles: ["admin", "scheduler", "chair", "dean", "faculty"],
                buildExtraQueries: ({ role, userId }) => {
                    if (role === "faculty" && userId) return [Query.equal("facultyUserId", userId)]
                    return []
                },
                toItem: (d, ctx) => ({
                    type: "class",
                    id: d.$id,
                    title: d.classCode ?? "Class",
                    subtitle:
                        d.subjectId
                            ? `Subject: ${d.subjectId}${d.status ? ` • ${d.status}` : ""}`
                            : d.status
                                ? `Status: ${d.status}`
                                : undefined,
                    href: hrefForItem("class", d.$id, ctx.role),
                }),
            },
            {
                type: "meeting",
                collectionId: COLLECTIONS.CLASS_MEETINGS,
                fields: ["dayOfWeek", "meetingType", "notes"],
                roles: ["admin", "scheduler", "faculty"],
                toItem: (d, ctx) => ({
                    type: "meeting",
                    id: d.$id,
                    title: `${d.dayOfWeek ?? "Day"} • ${d.startTime ?? ""}-${d.endTime ?? ""}`,
                    subtitle: d.roomId ? `Room: ${d.roomId}` : d.meetingType ? `${d.meetingType}` : undefined,
                    href: hrefForItem("meeting", d.$id, ctx.role),
                }),
            },
            {
                type: "availability",
                collectionId: COLLECTIONS.FACULTY_AVAILABILITY,
                fields: ["dayOfWeek", "notes", "preference"],
                roles: ["admin", "faculty"],
                buildExtraQueries: ({ role, userId }) => {
                    if (role === "faculty" && userId) return [Query.equal("userId", userId)]
                    return []
                },
                toItem: (d, ctx) => ({
                    type: "availability",
                    id: d.$id,
                    title: `${d.dayOfWeek ?? "Day"} • ${d.startTime ?? ""}-${d.endTime ?? ""}`,
                    subtitle: d.preference ? `Preference: ${d.preference}` : undefined,
                    href: hrefForItem("availability", d.$id, ctx.role),
                }),
            },

            {
                type: "request",
                collectionId: COLLECTIONS.CHANGE_REQUESTS,
                fields: ["type", "details", "status"],
                roles: ["admin", "scheduler", "chair", "dean"],
                toItem: (d, ctx) => ({
                    type: "request",
                    id: d.$id,
                    title: `Request • ${d.type ?? "Change"}`,
                    subtitle: d.status ? `Status: ${d.status}` : undefined,
                    href: hrefForItem("request", d.$id, ctx.role),
                }),
            },
            {
                type: "notification",
                collectionId: COLLECTIONS.NOTIFICATIONS,
                fields: ["title", "message", "type"],
                roles: ["admin", "scheduler", "faculty", "chair", "dean", "user"],
                toItem: (d, ctx) => ({
                    type: "notification",
                    id: d.$id,
                    title: d.title ?? "Notification",
                    subtitle: d.type ? `Type: ${d.type}` : undefined,
                    href: hrefForItem("notification", d.$id, ctx.role),
                }),
            },
            {
                type: "audit",
                collectionId: COLLECTIONS.AUDIT_LOGS,
                fields: ["action", "entityType"],
                roles: ["admin"],
                toItem: (d, ctx) => ({
                    type: "audit",
                    id: d.$id,
                    title: `${d.action ?? "Action"} • ${d.entityType ?? "Entity"}`,
                    subtitle: d.createdAt ? `${d.createdAt}` : undefined,
                    href: hrefForItem("audit", d.$id, ctx.role),
                }),
            },
        ]
    }, [])

    const runSearch = React.useCallback(
        async (query: string) => {
            const trimmed = query.trim()
            const seq = ++seqRef.current

            if (trimmed.length < 2) {
                setItems([])
                setLoading(false)
                return
            }

            setLoading(true)

            try {
                const pageResults = localPageSearch(pageCatalog, role, trimmed, 6)

                const visibleSpecs = searchSpecs.filter((spec) => {
                    const allowedBySpec = spec.roles.includes(role) || role === "admin"
                    const allowedByType = isTypeVisibleForRole(spec.type, role)
                    return allowedBySpec && allowedByType
                })

                const perCollectionLimit = 4
                const maxTotalDbItems = 18

                const dbPromises = visibleSpecs.map(async (spec) => {
                    const extra =
                        typeof spec.buildExtraQueries === "function"
                            ? spec.buildExtraQueries({ role, userId })
                            : []

                    const docs = await searchByFields(
                        spec.collectionId,
                        spec.fields,
                        trimmed,
                        perCollectionLimit,
                        extra
                    )

                    return docs.map((d) => spec.toItem(d, { role }))
                })

                const settled = await Promise.allSettled(dbPromises)

                if (seq !== seqRef.current) return

                const dbItems = settled
                    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
                    .filter(Boolean)

                const limitedDb = dbItems.slice(0, maxTotalDbItems)

                const merged = dedupeItems([...pageResults, ...limitedDb]).filter((it) =>
                    isTypeVisibleForRole(it.type, role)
                )

                setItems(merged)
            } catch (e: any) {
                if (seq !== seqRef.current) return
                toast.error(e?.message || "Search failed")
                setItems([])
            } finally {
                if (seq === seqRef.current) setLoading(false)
            }
        },
        [pageCatalog, role, searchSpecs, userId]
    )

    React.useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current)
        const next = q

        debounceRef.current = window.setTimeout(() => {
            void runSearch(next)
        }, 250)

        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current)
        }
    }, [q, runSearch])

    const grouped = React.useMemo(() => {
        const map = new Map<SearchItemType, SearchItem[]>()
        for (const it of items) {
            const arr = map.get(it.type) ?? []
            arr.push(it)
            map.set(it.type, arr)
        }
        return map
    }, [items])

    const onPick = React.useCallback(
        (it: SearchItem) => {
            setOpen(false)
            setMobileOpen(false)
            setQ("")
            navigate(it.href)
        },
        [navigate]
    )

    const placeholder =
        role === "admin"
            ? "Search everything (users, rooms, subjects, schedules...)"
            : "Search data allowed for your role..."

    const SearchBox = (
        <div className="relative min-w-0 w-64 xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                value={q}
                onChange={(e) => {
                    setQ(e.target.value)
                    setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full min-w-0 pl-9"
            />
        </div>
    )

    const Results = (
        <Command shouldFilter={false}>
            <CommandList>
                {q.trim().length < 2 ? (
                    <CommandEmpty>Type at least 2 characters…</CommandEmpty>
                ) : loading ? (
                    <div className="space-y-2 p-3 min-w-0">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                ) : items.length === 0 ? (
                    <CommandEmpty>No results. (Filtered by role: {role})</CommandEmpty>
                ) : (
                    <>
                        {Array.from(grouped.entries()).map(([t, arr]) => (
                            <CommandGroup key={t} heading={typeLabel(t)}>
                                {arr.slice(0, 8).map((it) => (
                                    <CommandItem
                                        key={`${it.type}:${it.id}`}
                                        value={`${it.type}:${it.id}`}
                                        onSelect={() => onPick(it)}
                                        className="flex items-start gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="truncate text-sm font-medium">
                                                    {it.title}
                                                </span>
                                                <Badge variant="secondary" className="shrink-0">
                                                    {typeBadge(it.type)}
                                                </Badge>
                                            </div>
                                            {it.subtitle ? (
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {it.subtitle}
                                                </div>
                                            ) : null}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </>
                )}
            </CommandList>
        </Command>
    )

    return (
        <header
            className={cn(
                className,
                "sticky top-0 z-50 shrink-0 w-full min-w-0 overflow-x-hidden border-b bg-background/70 backdrop-blur"
            )}
        >
            <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <SidebarTrigger aria-label="Toggle sidebar" />
                        </TooltipTrigger>
                        <TooltipContent>Toggle sidebar</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base">
                            {derivedTitle}
                        </h1>
                    </div>
                    {subtitle ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                <div className="hidden min-w-0 items-center justify-end gap-2 lg:flex">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>{SearchBox}</PopoverTrigger>
                        <PopoverContent
                            align="start"
                            sideOffset={8}
                            className="p-0 w-80 sm:w-96"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            {Results}
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-6 shrink-0" />

                    {actions ? (
                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                            {actions}
                        </div>
                    ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        className="lg:hidden"
                        aria-label="Search"
                        onClick={() => setMobileOpen(true)}
                    >
                        <Search className="h-4 w-4" />
                    </Button>

                    <NavUser placement="header" />
                </div>
            </div>

            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogContent className="sm:max-w-lg max-w-full">
                    <DialogHeader>
                        <DialogTitle>Search</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 min-w-0">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={placeholder}
                                className="w-full min-w-0 pl-9"
                                autoFocus
                            />
                        </div>

                        <div className="overflow-hidden rounded-lg border bg-card min-w-0">
                            {Results}
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Search results are filtered automatically based on your role.
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setMobileOpen(false)}>
                                Close
                            </Button>

                            <Button asChild onClick={() => setMobileOpen(false)}>
                                <Link to="/dashboard">Go to dashboard</Link>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </header>
    )
}
