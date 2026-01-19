/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    Users,
    ClipboardList,
    Plus,
    RefreshCw,
    Search,
    AlertTriangle,
    Trash2,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { departmentHeadApi } from "@/api/department-head"
import { useSession } from "@/hooks/use-session"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type AnyDoc = {
    $id: string
    [key: string]: any
}

type AssignmentRow = AnyDoc & {
    _subject?: AnyDoc
    _section?: AnyDoc
    _units: number
    _hours: number
    classCode?: string | null
    status?: string | null
}

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function safeNum(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function normalizeRole(role: any) {
    return String(role ?? "").trim().toLowerCase()
}

/**
 * ✅ More tolerant role match (covers: CHAIR, Department Head, dept head, etc.)
 */
function isDeptHeadFromRole(role: any) {
    const r = normalizeRole(role)
    return (
        r.includes("chair") ||
        r.includes("department head") ||
        r.includes("dept head") ||
        r.includes("department_head") ||
        r.includes("depthead")
    )
}

/**
 * ✅ Check role from any object (session user OR user profile doc)
 */
function isDeptHead(userLike: any) {
    if (!userLike) return false
    const role =
        userLike?.role ??
        userLike?.prefs?.role ??
        userLike?.prefs?.userRole ??
        userLike?.userRole ??
        userLike?.profile?.role ??
        userLike?.profile?.userRole

    return isDeptHeadFromRole(role)
}

/**
 * ✅ DepartmentId resolver:
 * tries profile first, then session user fallbacks
 */
function resolveDepartmentIdFrom(profile: any, sessionUser: any) {
    const candidates = [
        profile?.departmentId,
        profile?.deptId,

        sessionUser?.departmentId,
        sessionUser?.profile?.departmentId,
        sessionUser?.prefs?.departmentId,
        sessionUser?.prefs?.deptId,
        sessionUser?.prefs?.department,
    ]

    for (const c of candidates) {
        const v = safeStr(c)
        if (v) return v
    }
    return ""
}

function resolveUserId(user: any) {
    return safeStr(user?.$id || user?.id || user?.userId)
}

function subjectHours(sub: AnyDoc | undefined | null) {
    if (!sub) return 0
    const total = sub?.totalHours
    if (total !== null && total !== undefined) return safeNum(total, 0)
    return safeNum(sub?.lectureHours, 0) + safeNum(sub?.labHours, 0)
}

/**
 * ✅ Section label from DB:
 * "Year 1 - A"
 */
function sectionLabel(s: AnyDoc | undefined | null) {
    if (!s) return "—"
    const yl = safeNum(s?.yearLevel, 0)
    const nm = safeStr(s?.name)
    if (yl && nm) return `Year ${yl} - ${nm}`
    return nm || "—"
}

export default function FacultyWorkloadAssignmentPage() {
    const { user, loading: sessionLoading } = useSession()

    /**
     * ✅ Always load current user's profile from USER_PROFILES
     */
    const userId = React.useMemo(() => resolveUserId(user), [user])

    const [myProfile, setMyProfile] = React.useState<AnyDoc | null>(null)
    const [profileLoading, setProfileLoading] = React.useState(true)

    React.useEffect(() => {
        if (sessionLoading) return

        let alive = true
        setProfileLoading(true)

        if (!userId) {
            setMyProfile(null)
            setProfileLoading(false)
            return
        }

        departmentHeadApi.profiles
            .getByUserId(userId)
            .then((p) => {
                if (!alive) return
                setMyProfile(p ?? null)
            })
            .catch(() => {
                if (!alive) return
                setMyProfile(null)
            })
            .finally(() => {
                if (!alive) return
                setProfileLoading(false)
            })

        return () => {
            alive = false
        }
    }, [sessionLoading, userId])

    /**
     * ✅ Role check uses profile first, then session fallback
     */
    const myRoleOk = React.useMemo(() => {
        return isDeptHead(myProfile) || isDeptHead(user)
    }, [myProfile, user])

    /**
     * ✅ DepartmentId uses profile first, then session fallback
     */
    const departmentId = React.useMemo(() => {
        return resolveDepartmentIdFrom(myProfile, user)
    }, [myProfile, user])

    const [activeTerm, setActiveTerm] = React.useState<AnyDoc | null>(null)
    const [versions, setVersions] = React.useState<AnyDoc[]>([])
    const [selectedVersionId, setSelectedVersionId] = React.useState<string>("")

    const [subjects, setSubjects] = React.useState<AnyDoc[]>([])
    const [sections, setSections] = React.useState<AnyDoc[]>([])
    const [facultyUsers, setFacultyUsers] = React.useState<AnyDoc[]>([])
    const [facultyProfiles, setFacultyProfiles] = React.useState<AnyDoc[]>([])

    const [classes, setClasses] = React.useState<AnyDoc[]>([])

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    // UI state
    const [q, setQ] = React.useState("")
    const [selectedFacultyId, setSelectedFacultyId] = React.useState<string>("")

    // Assign dialog
    const [assignOpen, setAssignOpen] = React.useState(false)
    const [assignSectionId, setAssignSectionId] = React.useState("")
    const [assignSubjectId, setAssignSubjectId] = React.useState("")
    const [assignClassCode, setAssignClassCode] = React.useState("")
    const [assignRemarks, setAssignRemarks] = React.useState("")

    // Unassign confirm
    const [confirmUnassignId, setConfirmUnassignId] = React.useState<string | null>(null)

    const subjectMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        subjects.forEach((s) => m.set(s.$id, s))
        return m
    }, [subjects])

    const sectionMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        sections.forEach((s) => m.set(s.$id, s))
        return m
    }, [sections])

    /**
     * ✅ IMPORTANT CHANGE:
     * Sections are now ONLY from SECTIONS TABLE (DB)
     * No more hardcoded A-Z fallback.
     */
    const sortedSections = React.useMemo(() => {
        const copy = [...sections]
        copy.sort((a, b) => {
            const ya = safeNum(a?.yearLevel, 0)
            const yb = safeNum(b?.yearLevel, 0)
            if (ya !== yb) return ya - yb
            return safeStr(a?.name).localeCompare(safeStr(b?.name))
        })
        return copy
    }, [sections])

    const facultyProfileMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        facultyProfiles.forEach((p) => {
            const uid = safeStr(p?.userId)
            if (uid) m.set(uid, p)
        })
        return m
    }, [facultyProfiles])

    const facultyDisplayName = (u: AnyDoc) => safeStr(u?.name || u?.email || "Faculty")
    const versionLabel = (v: AnyDoc) => {
        const label = safeStr(v?.label)
        const version = safeStr(v?.version)
        const status = safeStr(v?.status)
        return label || (version ? `Version ${version}` : "Version") + (status ? ` • ${status}` : "")
    }

    const computeTotalsByFaculty = React.useCallback(() => {
        const totals = new Map<string, { units: number; hours: number; count: number }>()

        classes.forEach((c) => {
            const uid = safeStr(c?.facultyUserId)
            if (!uid) return

            const sub = subjectMap.get(safeStr(c?.subjectId))
            const units = safeNum(sub?.units, 0)
            const hours = subjectHours(sub)

            const prev = totals.get(uid) ?? { units: 0, hours: 0, count: 0 }
            totals.set(uid, {
                units: prev.units + units,
                hours: prev.hours + hours,
                count: prev.count + 1,
            })
        })

        return totals
    }, [classes, subjectMap])

    const totalsByFaculty = React.useMemo(() => computeTotalsByFaculty(), [computeTotalsByFaculty])

    /**
     * ✅ Load only when session/profile ready & has role + dept
     */
    const ready = !sessionLoading && !profileLoading
    const canLoad = ready && myRoleOk && Boolean(departmentId)

    const loadAll = React.useCallback(async () => {
        if (!canLoad) return

        setLoading(true)
        setError(null)

        try {
            const term = await departmentHeadApi.terms.getActive()
            setActiveTerm(term)

            if (!term?.$id) {
                setVersions([])
                setSelectedVersionId("")
                setSubjects([])
                setSections([])
                setFacultyUsers([])
                setFacultyProfiles([])
                setClasses([])
                return
            }

            const [ver, subs, secs, fac] = await Promise.all([
                departmentHeadApi.scheduleVersions.listByTermDepartment(term.$id, departmentId),
                departmentHeadApi.subjects.listByDepartment(departmentId),
                departmentHeadApi.sections.listByTermDepartment(term.$id, departmentId),
                departmentHeadApi.faculty.listByDepartment(departmentId),
            ])

            setVersions(ver)

            const preferred =
                ver.find((v) => String(v?.status).toLowerCase() === "active") ??
                ver.find((v) => String(v?.status).toLowerCase() === "locked") ??
                ver[0]

            const nextVersionId = safeStr(preferred?.$id)

            setSelectedVersionId((prev) => (prev ? prev : nextVersionId))

            setSubjects(subs)
            setSections(secs)
            setFacultyUsers(fac.users)
            setFacultyProfiles(fac.profiles)

            if (nextVersionId) {
                const cls = await departmentHeadApi.classes.listByVersion(term.$id, departmentId, nextVersionId)
                setClasses(cls)
            } else {
                setClasses([])
            }

            /**
             * ✅ selectedFacultyId = auth userId
             */
            setSelectedFacultyId((prev) => {
                if (prev) return prev
                const first = fac.users?.[0]
                return safeStr(first?.userId || first?.$id)
            })
        } catch (e: any) {
            setError(e?.message || "Failed to load data.")
        } finally {
            setLoading(false)
        }
    }, [canLoad, departmentId])

    React.useEffect(() => {
        if (!ready) return
        if (!myRoleOk) return
        if (!departmentId) return
        void loadAll()
    }, [ready, myRoleOk, departmentId, loadAll])

    // Reload classes when version changes
    React.useEffect(() => {
        const run = async () => {
            if (!activeTerm?.$id || !departmentId || !selectedVersionId) return
            try {
                const cls = await departmentHeadApi.classes.listByVersion(activeTerm.$id, departmentId, selectedVersionId)
                setClasses(cls)
            } catch {
                // ignore
            }
        }
        void run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVersionId])

    const filteredFaculty = React.useMemo(() => {
        const needle = q.trim().toLowerCase()
        if (!needle) return facultyUsers

        return facultyUsers.filter((u) => {
            const name = facultyDisplayName(u).toLowerCase()
            const email = safeStr(u?.email).toLowerCase()
            return name.includes(needle) || email.includes(needle)
        })
    }, [facultyUsers, q])

    /**
     * ✅ selectedFaculty matched by auth userId
     */
    const selectedFaculty = React.useMemo(() => {
        return facultyUsers.find((u) => safeStr(u?.userId || u?.$id) === safeStr(selectedFacultyId)) ?? null
    }, [facultyUsers, selectedFacultyId])

    const selectedFacultyAssignments = React.useMemo<AssignmentRow[]>(() => {
        if (!selectedFacultyId) return []

        return classes
            .filter((c) => safeStr(c?.facultyUserId) === safeStr(selectedFacultyId))
            .map((c): AssignmentRow => {
                const sub = subjectMap.get(safeStr(c?.subjectId))
                const sec = sectionMap.get(safeStr(c?.sectionId))

                return {
                    ...(c as AnyDoc),
                    _subject: sub,
                    _section: sec,
                    _units: safeNum(sub?.units, 0),
                    _hours: subjectHours(sub),
                }
            })
            .sort((a, b) => {
                const aLabel = a?._section ? sectionLabel(a?._section) : safeStr(a?.sectionId)
                const bLabel = b?._section ? sectionLabel(b?._section) : safeStr(b?.sectionId)
                return aLabel.localeCompare(bLabel)
            })
    }, [classes, selectedFacultyId, subjectMap, sectionMap])

    const selectedTotals = React.useMemo(() => {
        const t = totalsByFaculty.get(safeStr(selectedFacultyId))
        return t ?? { units: 0, hours: 0, count: 0 }
    }, [totalsByFaculty, selectedFacultyId])

    const limits = React.useMemo(() => {
        if (!selectedFacultyId) return { maxUnits: null as number | null, maxHours: null as number | null }
        const p = facultyProfileMap.get(safeStr(selectedFacultyId))
        return {
            maxUnits: p?.maxUnits !== null && p?.maxUnits !== undefined ? safeNum(p?.maxUnits, 0) : null,
            maxHours: p?.maxHours !== null && p?.maxHours !== undefined ? safeNum(p?.maxHours, 0) : null,
        }
    }, [facultyProfileMap, selectedFacultyId])

    const unitProgress = React.useMemo(() => {
        if (!limits.maxUnits || limits.maxUnits <= 0) return null
        const pct = Math.min(100, Math.round((selectedTotals.units / limits.maxUnits) * 100))
        return pct
    }, [limits.maxUnits, selectedTotals.units])

    const hourProgress = React.useMemo(() => {
        if (!limits.maxHours || limits.maxHours <= 0) return null
        const pct = Math.min(100, Math.round((selectedTotals.hours / limits.maxHours) * 100))
        return pct
    }, [limits.maxHours, selectedTotals.hours])

    async function onAssign() {
        try {
            if (!activeTerm?.$id) throw new Error("No active term.")
            if (!selectedVersionId) throw new Error("No schedule version selected.")
            if (!departmentId) throw new Error("No department assigned.")
            if (!selectedFacultyId) throw new Error("Select a faculty first.")
            if (!assignSectionId) throw new Error("Please select a section.")
            if (!assignSubjectId) throw new Error("Please select a subject.")

            /**
             * ✅ REQUIRED:
             * Section must be a valid DB section row id (from SECTIONS TABLE).
             */
            const sec = sectionMap.get(safeStr(assignSectionId))
            if (!sec) throw new Error("Selected section is not found in the database. Please refresh and try again.")

            await departmentHeadApi.classes.assignOrCreate({
                versionId: selectedVersionId,
                termId: activeTerm.$id,
                departmentId,
                sectionId: safeStr(assignSectionId),
                subjectId: assignSubjectId,
                facultyUserId: selectedFacultyId, // ✅ userId (auth id)
                classCode: assignClassCode.trim() || null,
                deliveryMode: null,
                remarks: assignRemarks.trim() || null,
            })

            toast.success("Assigned successfully.")
            setAssignOpen(false)

            setAssignSectionId("")
            setAssignSubjectId("")
            setAssignClassCode("")
            setAssignRemarks("")

            const cls = await departmentHeadApi.classes.listByVersion(activeTerm.$id, departmentId, selectedVersionId)
            setClasses(cls)
        } catch (e: any) {
            toast.error(e?.message || "Failed to assign.")
        }
    }

    async function onUnassignConfirm() {
        if (!confirmUnassignId) return

        try {
            await departmentHeadApi.classes.unassign(confirmUnassignId)
            toast.success("Unassigned successfully.")
            setConfirmUnassignId(null)

            if (activeTerm?.$id && selectedVersionId) {
                const cls = await departmentHeadApi.classes.listByVersion(activeTerm.$id, departmentId, selectedVersionId)
                setClasses(cls)
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to unassign.")
        }
    }

    const headerTitle = "Faculty Workload Assignment"
    const headerSubtitle = "Assign subjects/sections and track total units & hours per faculty."

    const termLabel = React.useMemo(() => {
        if (!activeTerm) return "No active term"
        const sy = safeStr(activeTerm?.schoolYear)
        const sem = safeStr(activeTerm?.semester)
        if (!sy && !sem) return "Active Term"
        return `${sy}${sy && sem ? " • " : ""}${sem}`
    }, [activeTerm])

    const noDept = ready && myRoleOk && !departmentId
    const noVersion = Boolean(activeTerm?.$id) && versions.length === 0
    const showRoleError = ready && !myRoleOk

    const noSections = Boolean(activeTerm?.$id) && sections.length === 0
    const noSubjects = Boolean(activeTerm?.$id) && subjects.length === 0

    return (
        <DashboardLayout
            title={headerTitle}
            subtitle={headerSubtitle}
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void loadAll()}
                        disabled={loading || sessionLoading || profileLoading || !canLoad}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                        <span className="ml-2">Refresh</span>
                    </Button>
                </div>
            }
        >
            <div className="p-4 md:p-6 space-y-4">
                {showRoleError ? (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access restricted</AlertTitle>
                        <AlertDescription>
                            Your account does not appear to be a Department Head role (CHAIR).
                            Please contact the administrator.
                        </AlertDescription>
                    </Alert>
                ) : null}

                {noDept ? (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Missing Department</AlertTitle>
                        <AlertDescription>
                            Your profile has no <b>departmentId</b>. Please assign your department in the User Profile table.
                        </AlertDescription>
                    </Alert>
                ) : null}

                {error ? (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Load failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-12">
                    {/* LEFT: Faculty list */}
                    <Card className="lg:col-span-4">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Faculty
                            </CardTitle>
                            <CardDescription className="flex items-center justify-between gap-2">
                                <span className="truncate">{termLabel}</span>
                                <Badge variant="secondary" className="shrink-0">
                                    {facultyUsers.length} total
                                </Badge>
                            </CardDescription>

                            <div className="pt-2 space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70" />
                                    <Input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search faculty..."
                                        className="pl-9"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Label className="text-xs opacity-70 pb-2">Schedule Version</Label>
                                        <Select
                                            value={selectedVersionId}
                                            onValueChange={(v) => setSelectedVersionId(v)}
                                            disabled={loading || versions.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select version" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {versions.map((v) => (
                                                    <SelectItem key={v.$id} value={v.$id}>
                                                        {versionLabel(v)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {noVersion ? (
                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>No schedule version</AlertTitle>
                                        <AlertDescription>
                                            Create a schedule version first so assignments can be linked to a version.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                {noSections ? (
                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>No sections found</AlertTitle>
                                        <AlertDescription>
                                            Please add sections in the <b>SECTIONS</b> table for this term + department.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                {noSubjects ? (
                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>No subjects found</AlertTitle>
                                        <AlertDescription>
                                            Please add subjects in the <b>SUBJECTS</b> table for this department.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </div>
                        </CardHeader>

                        <Separator />

                        <CardContent className="p-0">
                            {loading || sessionLoading || profileLoading ? (
                                <div className="p-4 space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <ScrollArea className="h-120">
                                    <div className="p-2 space-y-1">
                                        {filteredFaculty.length === 0 ? (
                                            <div className="p-4 text-sm opacity-70">
                                                No faculty found.
                                            </div>
                                        ) : (
                                            filteredFaculty.map((f) => {
                                                const id = safeStr(f?.userId || f?.$id)
                                                const t = totalsByFaculty.get(id) ?? { units: 0, hours: 0, count: 0 }
                                                const prof = facultyProfileMap.get(id)

                                                const maxUnits =
                                                    prof?.maxUnits !== null && prof?.maxUnits !== undefined
                                                        ? safeNum(prof?.maxUnits, 0)
                                                        : null

                                                const maxHours =
                                                    prof?.maxHours !== null && prof?.maxHours !== undefined
                                                        ? safeNum(prof?.maxHours, 0)
                                                        : null

                                                const unitPct =
                                                    maxUnits && maxUnits > 0
                                                        ? Math.min(100, Math.round((t.units / maxUnits) * 100))
                                                        : null

                                                const hoursText =
                                                    maxHours && maxHours > 0 ? `${t.hours}/${maxHours} hours` : `${t.hours} hours`

                                                const active = safeStr(selectedFacultyId) === id

                                                return (
                                                    <button
                                                        key={id}
                                                        onClick={() => setSelectedFacultyId(id)}
                                                        className={cn(
                                                            "w-full rounded-xl border px-3 py-2 text-left transition",
                                                            active
                                                                ? "border-primary/50 bg-primary/10"
                                                                : "border-border/60 hover:bg-accent/30"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="font-medium truncate">
                                                                    {facultyDisplayName(f)}
                                                                </div>
                                                                <div className="text-xs opacity-70 truncate">
                                                                    {safeStr(f?.email)}
                                                                </div>
                                                            </div>

                                                            <Badge variant={t.units > 0 ? "default" : "secondary"} className="shrink-0">
                                                                {t.units}u • {t.hours}h
                                                            </Badge>
                                                        </div>

                                                        <div className="mt-2 space-y-1">
                                                            <div className="flex items-center justify-between text-xs opacity-70">
                                                                <span>{t.count} assigned</span>
                                                                {maxUnits ? <span>{t.units}/{maxUnits} units</span> : <span>&nbsp;</span>}
                                                            </div>

                                                            {unitPct !== null ? <Progress value={unitPct} /> : null}

                                                            <div className="text-xs opacity-70 flex items-center justify-end">
                                                                {hoursText}
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>

                    {/* RIGHT: Assignments */}
                    <Card className="lg:col-span-8">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Assignments
                            </CardTitle>
                            <CardDescription className="flex items-center justify-between gap-2">
                                <span className="truncate">
                                    {selectedFaculty ? `For: ${facultyDisplayName(selectedFaculty)}` : "Select a faculty"}
                                </span>

                                <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            size="sm"
                                            disabled={
                                                loading ||
                                                !selectedFacultyId ||
                                                !activeTerm?.$id ||
                                                !selectedVersionId ||
                                                !departmentId ||
                                                versions.length === 0 ||
                                                !canLoad ||
                                                sections.length === 0 ||
                                                subjects.length === 0
                                            }
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span className="ml-2">Assign</span>
                                        </Button>
                                    </DialogTrigger>

                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>Assign Workload</DialogTitle>
                                            <DialogDescription>
                                                Assign a <b>subject</b> to a <b>section</b> for the selected faculty.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-2">
                                            <div className="space-y-2">
                                                <Label>Faculty</Label>
                                                <Input value={selectedFaculty ? facultyDisplayName(selectedFaculty) : ""} disabled />
                                            </div>

                                            {/* ✅ Sections are now ONLY from DB */}
                                            <div className="grid gap-4 sm:grid-cols-2 min-w-0">
                                                <div className="space-y-2 min-w-0">
                                                    <Label>Section</Label>
                                                    <Select
                                                        value={assignSectionId}
                                                        onValueChange={(v) => setAssignSectionId(v)}
                                                        disabled={sortedSections.length === 0}
                                                    >
                                                        <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                            <SelectValue placeholder="Select section" className="truncate" />
                                                        </SelectTrigger>

                                                        <SelectContent
                                                            className="max-w-full"
                                                            style={{ width: "var(--radix-select-trigger-width)" }}
                                                        >
                                                            {sortedSections.length === 0 ? (
                                                                <SelectItem value="none" disabled>
                                                                    No sections available
                                                                </SelectItem>
                                                            ) : (
                                                                sortedSections.map((s) => (
                                                                    <SelectItem key={s.$id} value={s.$id} className="max-w-full">
                                                                        <span className="block max-w-full truncate">
                                                                            {sectionLabel(s)}
                                                                        </span>
                                                                    </SelectItem>
                                                                ))
                                                            )}
                                                        </SelectContent>
                                                    </Select>

                                                    <div className="text-xs opacity-70">
                                                        Sections come from the <b>SECTIONS</b> table. If missing, add them in Admin → Sections.
                                                    </div>
                                                </div>

                                                <div className="space-y-2 min-w-0">
                                                    <Label>Subject</Label>
                                                    <Select value={assignSubjectId} onValueChange={setAssignSubjectId}>
                                                        <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                            <SelectValue placeholder="Select subject" className="truncate" />
                                                        </SelectTrigger>

                                                        <SelectContent
                                                            className="max-w-full"
                                                            style={{ width: "var(--radix-select-trigger-width)" }}
                                                        >
                                                            {subjects.map((s) => (
                                                                <SelectItem key={s.$id} value={s.$id} className="max-w-full">
                                                                    <span className="block max-w-full truncate">
                                                                        {safeStr(s?.code)} • {safeStr(s?.title)}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Class Code (optional)</Label>
                                                    <Input
                                                        value={assignClassCode}
                                                        onChange={(e) => setAssignClassCode(e.target.value)}
                                                        placeholder="e.g. IT-301"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Remarks (optional)</Label>
                                                    <Input
                                                        value={assignRemarks}
                                                        onChange={(e) => setAssignRemarks(e.target.value)}
                                                        placeholder="e.g. overload / special case"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                                            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={() => void onAssign()}>
                                                Assign Now
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardDescription>
                        </CardHeader>

                        <Separator />

                        <CardContent className="p-4 space-y-4">
                            {!activeTerm?.$id ? (
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>No active term</AlertTitle>
                                    <AlertDescription>
                                        Please activate an Academic Term first before assigning workloads.
                                    </AlertDescription>
                                </Alert>
                            ) : null}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Card className="border-border/60">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Total Units</CardTitle>
                                        <CardDescription>
                                            {limits.maxUnits ? `Limit: ${limits.maxUnits}` : "No limit set"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="text-2xl font-semibold">{selectedTotals.units}</div>
                                        {unitProgress !== null ? (
                                            <div className="space-y-1">
                                                <Progress value={unitProgress} />
                                                <div className="text-xs opacity-70">{unitProgress}% of limit</div>
                                            </div>
                                        ) : (
                                            <div className="text-xs opacity-70">Set maxUnits in faculty profile to track progress.</div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-border/60">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Total Hours</CardTitle>
                                        <CardDescription>
                                            {limits.maxHours ? `Limit: ${limits.maxHours}` : "No limit set"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="text-2xl font-semibold">{selectedTotals.hours}</div>
                                        {hourProgress !== null ? (
                                            <div className="space-y-1">
                                                <Progress value={hourProgress} />
                                                <div className="text-xs opacity-70">{hourProgress}% of limit</div>
                                            </div>
                                        ) : (
                                            <div className="text-xs opacity-70">Set maxHours in faculty profile to track progress.</div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">
                                    Assigned Classes
                                    <span className="ml-2 text-xs opacity-70">
                                        ({selectedFacultyAssignments.length})
                                    </span>
                                </div>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void loadAll()}
                                    disabled={loading || !canLoad}
                                >
                                    <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                                    <span className="ml-2">Reload</span>
                                </Button>
                            </div>

                            {loading || sessionLoading || profileLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : selectedFacultyAssignments.length === 0 ? (
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>No assignments</AlertTitle>
                                    <AlertDescription>
                                        This faculty has no assigned subjects yet.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="rounded-xl border border-border/60 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Section</TableHead>
                                                <TableHead>Subject</TableHead>
                                                <TableHead className="text-right">Units</TableHead>
                                                <TableHead className="text-right">Hours</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {selectedFacultyAssignments.map((c) => {
                                                const sec = c?._section
                                                const sub = c?._subject
                                                const sectionText = sec ? sectionLabel(sec) : (safeStr(c?.sectionId) || "—")

                                                return (
                                                    <TableRow key={c.$id}>
                                                        <TableCell className="font-medium">
                                                            {sectionText}
                                                        </TableCell>

                                                        <TableCell className="min-w-0">
                                                            <div className="truncate">
                                                                <span className="opacity-80">{safeStr(sub?.code)}</span>
                                                                {sub?.title ? <span> • {safeStr(sub?.title)}</span> : null}
                                                            </div>

                                                            {c?.classCode ? (
                                                                <div className="text-xs opacity-70">
                                                                    Class Code: {safeStr(c?.classCode)}
                                                                </div>
                                                            ) : null}
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            {safeNum(c?._units, 0)}
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            {safeNum(c?._hours, 0)}
                                                        </TableCell>

                                                        <TableCell>
                                                            <Badge variant="secondary">{safeStr(c?.status || "Planned")}</Badge>
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => setConfirmUnassignId(c.$id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="ml-2">Unassign</span>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ✅ Unassign Confirmation */}
            <AlertDialog open={Boolean(confirmUnassignId)} onOpenChange={(v) => (!v ? setConfirmUnassignId(null) : null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unassign this class?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the faculty assignment from the selected class offering.
                            You can assign it again anytime.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmUnassignId(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void onUnassignConfirm()}>
                            Unassign
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    )
}
