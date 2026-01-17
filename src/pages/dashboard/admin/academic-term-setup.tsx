/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    CalendarDays,
    Clock,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCcw,
    ShieldCheck,
    Trash2,
    Lock,
    Unlock,
} from "lucide-react"
import { format } from "date-fns"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"

type AcademicTermDoc = {
    $id: string
    schoolYear: string
    semester: string
    startDate: string
    endDate: string
    isActive: boolean
    isLocked: boolean
    $createdAt?: string
}

type TimeBlockDoc = {
    $id: string
    termId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    label?: string | null
    isActive: boolean
    $createdAt?: string
}

type PolicyDoc = {
    $id: string
    termId?: string | null
    key: string
    value: string
    description?: string | null
}

const SEMESTERS = [
    "1st Semester",
    "2nd Semester",
    "Summer",
] as const

const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

const POLICY_PRESETS = [
    {
        key: "class_duration_minutes",
        label: "Class Duration (minutes)",
        hint: "Example: 50, 60, 90",
        placeholder: "60",
    },
    {
        key: "break_minutes_between_classes",
        label: "Break / Gap Between Classes (minutes)",
        hint: "Recommended: 10–15",
        placeholder: "10",
    },
    {
        key: "day_start_time",
        label: "Default Day Start Time",
        hint: "Example: 07:30",
        placeholder: "07:30",
    },
    {
        key: "day_end_time",
        label: "Default Day End Time",
        hint: "Example: 17:30",
        placeholder: "17:30",
    },
] as const

function safeIsoDate(d: Date | undefined | null) {
    if (!d) return ""
    try {
        return d.toISOString()
    } catch {
        return ""
    }
}

function parseDate(v: string) {
    try {
        const d = new Date(v)
        return Number.isFinite(d.getTime()) ? d : undefined
    } catch {
        return undefined
    }
}

function prettyDate(v: string) {
    const d = parseDate(v)
    if (!d) return "—"
    try {
        return format(d, "MMM dd, yyyy")
    } catch {
        return "—"
    }
}

function termLabel(t: AcademicTermDoc) {
    return `${t.schoolYear} • ${t.semester}`
}

async function listDocumentsSafe(collectionId: string, queries: any[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries)
    return (res?.documents ?? []) as any[]
}

export default function AdminAcademicTermSetupPage() {
    const [tab, setTab] = React.useState("terms")

    // ✅ Terms
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [loadingTerms, setLoadingTerms] = React.useState(false)

    const [termDialogOpen, setTermDialogOpen] = React.useState(false)
    const [editingTerm, setEditingTerm] = React.useState<AcademicTermDoc | null>(null)

    const [termSchoolYear, setTermSchoolYear] = React.useState("")
    const [termSemester, setTermSemester] = React.useState<(typeof SEMESTERS)[number]>("1st Semester")
    const [termStartDate, setTermStartDate] = React.useState<Date | undefined>(undefined)
    const [termEndDate, setTermEndDate] = React.useState<Date | undefined>(undefined)
    const [termIsActive, setTermIsActive] = React.useState(true)
    const [termIsLocked, setTermIsLocked] = React.useState(false)
    const [savingTerm, setSavingTerm] = React.useState(false)

    // ✅ Term selection for other tabs
    const [selectedTermId, setSelectedTermId] = React.useState<string>("")

    // ✅ Time blocks
    const [timeBlocks, setTimeBlocks] = React.useState<TimeBlockDoc[]>([])
    const [loadingTimeBlocks, setLoadingTimeBlocks] = React.useState(false)

    const [blockDialogOpen, setBlockDialogOpen] = React.useState(false)
    const [editingBlock, setEditingBlock] = React.useState<TimeBlockDoc | null>(null)

    const [blockDay, setBlockDay] = React.useState<(typeof DAYS)[number]>("Monday")
    const [blockStartTime, setBlockStartTime] = React.useState("08:00")
    const [blockEndTime, setBlockEndTime] = React.useState("09:00")
    const [blockLabel, setBlockLabel] = React.useState("")
    const [blockIsActive, setBlockIsActive] = React.useState(true)
    const [savingBlock, setSavingBlock] = React.useState(false)

    // ✅ Policies
    const [policies, setPolicies] = React.useState<PolicyDoc[]>([])
    const [loadingPolicies, setLoadingPolicies] = React.useState(false)

    const [policyDialogOpen, setPolicyDialogOpen] = React.useState(false)
    const [editingPolicy, setEditingPolicy] = React.useState<PolicyDoc | null>(null)

    const [policyKey, setPolicyKey] = React.useState<string>(POLICY_PRESETS[0].key)
    const [policyValue, setPolicyValue] = React.useState<string>("")
    const [policyDescription, setPolicyDescription] = React.useState<string>("")
    const [savingPolicy, setSavingPolicy] = React.useState(false)

    const selectedTerm = React.useMemo(
        () => terms.find((t) => t.$id === selectedTermId) ?? null,
        [terms, selectedTermId]
    )

    const resetTermForm = React.useCallback(() => {
        setEditingTerm(null)
        setTermSchoolYear("")
        setTermSemester("1st Semester")
        setTermStartDate(undefined)
        setTermEndDate(undefined)
        setTermIsActive(true)
        setTermIsLocked(false)
    }, [])

    const resetBlockForm = React.useCallback(() => {
        setEditingBlock(null)
        setBlockDay("Monday")
        setBlockStartTime("08:00")
        setBlockEndTime("09:00")
        setBlockLabel("")
        setBlockIsActive(true)
    }, [])

    const resetPolicyForm = React.useCallback(() => {
        setEditingPolicy(null)
        setPolicyKey(POLICY_PRESETS[0].key)
        setPolicyValue("")
        setPolicyDescription("")
    }, [])

    const loadTerms = React.useCallback(async () => {
        setLoadingTerms(true)
        try {
            const docs = (await listDocumentsSafe(COLLECTIONS.ACADEMIC_TERMS, [
                Query.orderDesc("$createdAt"),
                Query.limit(200),
            ])) as AcademicTermDoc[]

            setTerms(docs)

            // ✅ Auto select active term (or first)
            const active = docs.find((d) => d.isActive)
            const nextId = active?.$id ?? docs[0]?.$id ?? ""
            if (nextId && !selectedTermId) {
                setSelectedTermId(nextId)
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load academic terms.")
        } finally {
            setLoadingTerms(false)
        }
    }, [selectedTermId])

    const loadTimeBlocks = React.useCallback(async (termId: string) => {
        if (!termId) return
        setLoadingTimeBlocks(true)
        try {
            const docs = (await listDocumentsSafe(COLLECTIONS.TIME_BLOCKS, [
                Query.equal("termId", termId),
                Query.orderAsc("dayOfWeek"),
                Query.orderAsc("startTime"),
                Query.limit(300),
            ])) as TimeBlockDoc[]

            setTimeBlocks(docs)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load time blocks.")
        } finally {
            setLoadingTimeBlocks(false)
        }
    }, [])

    const loadPolicies = React.useCallback(async (termId: string) => {
        if (!termId) return
        setLoadingPolicies(true)
        try {
            const docs = (await listDocumentsSafe(COLLECTIONS.SYSTEM_POLICIES, [
                Query.equal("termId", termId),
                Query.orderAsc("key"),
                Query.limit(200),
            ])) as PolicyDoc[]

            setPolicies(docs)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load policies.")
        } finally {
            setLoadingPolicies(false)
        }
    }, [])

    React.useEffect(() => {
        void loadTerms()
    }, [loadTerms])

    React.useEffect(() => {
        if (!selectedTermId) return
        void loadTimeBlocks(selectedTermId)
        void loadPolicies(selectedTermId)
    }, [selectedTermId, loadTimeBlocks, loadPolicies])

    const openCreateTerm = () => {
        resetTermForm()
        setTermDialogOpen(true)
    }

    const openEditTerm = (t: AcademicTermDoc) => {
        setEditingTerm(t)
        setTermSchoolYear(t.schoolYear ?? "")
        setTermSemester((SEMESTERS as any).includes(t.semester) ? (t.semester as any) : "1st Semester")
        setTermStartDate(parseDate(t.startDate))
        setTermEndDate(parseDate(t.endDate))
        setTermIsActive(Boolean(t.isActive))
        setTermIsLocked(Boolean(t.isLocked))
        setTermDialogOpen(true)
    }

    const saveTerm = async () => {
        const sy = termSchoolYear.trim()
        if (!sy) {
            toast.error("School year is required. Example: 2025-2026")
            return
        }

        if (!termStartDate || !termEndDate) {
            toast.error("Start date and end date are required.")
            return
        }

        const startISO = safeIsoDate(termStartDate)
        const endISO = safeIsoDate(termEndDate)

        if (!startISO || !endISO) {
            toast.error("Invalid date values.")
            return
        }

        if (new Date(startISO).getTime() > new Date(endISO).getTime()) {
            toast.error("Start date must be before End date.")
            return
        }

        setSavingTerm(true)
        try {
            const payload = {
                schoolYear: sy,
                semester: termSemester,
                startDate: startISO,
                endDate: endISO,
                isActive: Boolean(termIsActive),
                isLocked: Boolean(termIsLocked),
            }

            if (editingTerm) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    editingTerm.$id,
                    payload
                )
                toast.success("Academic term updated.")
            } else {
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    ID.unique(),
                    payload
                )
                toast.success("Academic term created.")
            }

            // ✅ Enforce single active term if enabled
            if (termIsActive) {
                const updated = await listDocumentsSafe(COLLECTIONS.ACADEMIC_TERMS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]) as AcademicTermDoc[]

                const activeId = editingTerm?.$id

                const target = updated.find(
                    (x) => x.schoolYear === sy && x.semester === termSemester
                )

                const newActiveId = target?.$id ?? activeId

                if (newActiveId) {
                    await Promise.all(
                        updated
                            .filter((x) => x.$id !== newActiveId && x.isActive)
                            .map((x) =>
                                databases.updateDocument(
                                    DATABASE_ID,
                                    COLLECTIONS.ACADEMIC_TERMS,
                                    x.$id,
                                    { isActive: false }
                                )
                            )
                    )
                }
            }

            setTermDialogOpen(false)
            resetTermForm()
            await loadTerms()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to save academic term.")
        } finally {
            setSavingTerm(false)
        }
    }

    const setActiveTerm = async (t: AcademicTermDoc) => {
        if (!t?.$id) return
        try {
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, t.$id, {
                isActive: true,
            })

            const others = terms.filter((x) => x.$id !== t.$id && x.isActive)
            if (others.length > 0) {
                await Promise.all(
                    others.map((x) =>
                        databases.updateDocument(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, x.$id, {
                            isActive: false,
                        })
                    )
                )
            }

            toast.success(`Active term set to: ${termLabel(t)}`)
            setSelectedTermId(t.$id)
            await loadTerms()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to set active term.")
        }
    }

    const toggleLockTerm = async (t: AcademicTermDoc) => {
        if (!t?.$id) return
        try {
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, t.$id, {
                isLocked: !t.isLocked,
            })
            toast.success(t.isLocked ? "Term unlocked." : "Term locked.")
            await loadTerms()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to update lock status.")
        }
    }

    const deleteTerm = async (t: AcademicTermDoc) => {
        if (!t?.$id) return

        const ok = window.confirm(
            `Delete term "${termLabel(t)}"?\n\nThis removes only the term record. Make sure no schedules depend on it.`
        )
        if (!ok) return

        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, t.$id)
            toast.success("Academic term deleted.")

            if (selectedTermId === t.$id) {
                setSelectedTermId("")
            }

            await loadTerms()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to delete term.")
        }
    }

    const openCreateBlock = () => {
        resetBlockForm()
        setBlockDialogOpen(true)
    }

    const openEditBlock = (b: TimeBlockDoc) => {
        setEditingBlock(b)
        setBlockDay((DAYS as any).includes(b.dayOfWeek) ? (b.dayOfWeek as any) : "Monday")
        setBlockStartTime(b.startTime ?? "08:00")
        setBlockEndTime(b.endTime ?? "09:00")
        setBlockLabel(b.label ?? "")
        setBlockIsActive(Boolean(b.isActive))
        setBlockDialogOpen(true)
    }

    const saveBlock = async () => {
        if (!selectedTermId) {
            toast.error("Select a term first.")
            return
        }

        const start = blockStartTime.trim()
        const end = blockEndTime.trim()

        if (!start || !end) {
            toast.error("Start time and end time are required.")
            return
        }

        if (start >= end) {
            toast.error("Start time must be before End time.")
            return
        }

        setSavingBlock(true)
        try {
            const payload = {
                termId: selectedTermId,
                dayOfWeek: blockDay,
                startTime: start,
                endTime: end,
                label: blockLabel.trim() || null,
                isActive: Boolean(blockIsActive),
            }

            if (editingBlock) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.TIME_BLOCKS, editingBlock.$id, payload)
                toast.success("Time block updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.TIME_BLOCKS, ID.unique(), payload)
                toast.success("Time block created.")
            }

            setBlockDialogOpen(false)
            resetBlockForm()
            await loadTimeBlocks(selectedTermId)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to save time block.")
        } finally {
            setSavingBlock(false)
        }
    }

    const deleteBlock = async (b: TimeBlockDoc) => {
        const ok = window.confirm(`Delete this time block?\n\n${b.dayOfWeek} ${b.startTime} - ${b.endTime}`)
        if (!ok) return

        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TIME_BLOCKS, b.$id)
            toast.success("Time block deleted.")
            await loadTimeBlocks(selectedTermId)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to delete time block.")
        }
    }

    const openCreatePolicy = () => {
        resetPolicyForm()
        setPolicyDialogOpen(true)
    }

    const openEditPolicy = (p: PolicyDoc) => {
        setEditingPolicy(p)
        setPolicyKey(p.key ?? POLICY_PRESETS[0].key)
        setPolicyValue(p.value ?? "")
        setPolicyDescription(p.description ?? "")
        setPolicyDialogOpen(true)
    }

    const savePolicy = async () => {
        if (!selectedTermId) {
            toast.error("Select a term first.")
            return
        }

        const k = policyKey.trim()
        const v = policyValue.trim()

        if (!k) {
            toast.error("Policy key is required.")
            return
        }
        if (!v) {
            toast.error("Policy value is required.")
            return
        }

        setSavingPolicy(true)
        try {
            const payload = {
                termId: selectedTermId,
                key: k,
                value: v,
                description: policyDescription.trim() || null,
            }

            if (editingPolicy) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SYSTEM_POLICIES, editingPolicy.$id, payload)
                toast.success("Policy updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.SYSTEM_POLICIES, ID.unique(), payload)
                toast.success("Policy created.")
            }

            setPolicyDialogOpen(false)
            resetPolicyForm()
            await loadPolicies(selectedTermId)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to save policy.")
        } finally {
            setSavingPolicy(false)
        }
    }

    const deletePolicy = async (p: PolicyDoc) => {
        const ok = window.confirm(`Delete policy "${p.key}"?`)
        if (!ok) return

        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SYSTEM_POLICIES, p.$id)
            toast.success("Policy deleted.")
            await loadPolicies(selectedTermId)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to delete policy.")
        }
    }

    const pageActions = (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                void loadTerms()
                                if (selectedTermId) {
                                    void loadTimeBlocks(selectedTermId)
                                    void loadPolicies(selectedTermId)
                                }
                            }}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reload terms, blocks, and policies</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <Button size="sm" onClick={openCreateTerm}>
                <Plus className="mr-2 h-4 w-4" />
                New Term
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Academic Term Setup"
            subtitle="Set school year/semester, calendars, time blocks, and class duration policies."
            actions={pageActions}
        >
            <div className="p-6 pt-4 min-w-0">
                <Card className="min-w-0">
                    <CardHeader className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Academic Term Setup
                        </CardTitle>
                        <CardDescription>
                            Manage school years and semesters, define time blocks, and configure system scheduling rules.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <Tabs value={tab} onValueChange={setTab}>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <TabsList className="w-full md:w-auto">
                                    <TabsTrigger value="terms">Terms</TabsTrigger>
                                    <TabsTrigger value="time-blocks">Time Blocks</TabsTrigger>
                                    <TabsTrigger value="policies">Policies</TabsTrigger>
                                </TabsList>

                                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm text-muted-foreground">Selected Term</Label>
                                        <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                                            <SelectTrigger className="w-full md:w-72">
                                                <SelectValue placeholder="Select a term..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {terms.map((t) => (
                                                    <SelectItem key={t.$id} value={t.$id}>
                                                        {termLabel(t)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedTerm ? (
                                        <div className="flex items-center gap-2">
                                            {selectedTerm.isActive ? (
                                                <Badge variant="default" className="gap-1">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}

                                            {selectedTerm.isLocked ? (
                                                <Badge variant="destructive" className="gap-1">
                                                    <Lock className="h-3.5 w-3.5" />
                                                    Locked
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1">
                                                    <Unlock className="h-3.5 w-3.5" />
                                                    Unlocked
                                                </Badge>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <Separator className="my-4" />

                            {/* ===================== TERMS TAB ===================== */}
                            <TabsContent value="terms" className="min-w-0">
                                {loadingTerms ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : terms.length === 0 ? (
                                    <Alert>
                                        <AlertTitle>No terms yet</AlertTitle>
                                        <AlertDescription>
                                            Create your first academic term (school year + semester) to begin scheduling setup.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="rounded-lg border min-w-0 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[28%]">School Year</TableHead>
                                                    <TableHead className="w-[18%]">Semester</TableHead>
                                                    <TableHead className="w-[26%]">Dates</TableHead>
                                                    <TableHead className="w-[12%]">Status</TableHead>
                                                    <TableHead className="w-[16%] text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {terms.map((t) => (
                                                    <TableRow key={t.$id} className={cn(selectedTermId === t.$id && "bg-muted/40")}>
                                                        <TableCell className="font-medium">{t.schoolYear}</TableCell>
                                                        <TableCell>{t.semester}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {prettyDate(t.startDate)} → {prettyDate(t.endDate)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                {t.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                                                                {t.isLocked ? (
                                                                    <Badge variant="destructive">Locked</Badge>
                                                                ) : (
                                                                    <Badge variant="outline">Unlocked</Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-56">
                                                                    <DropdownMenuLabel>Term Actions</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />

                                                                    <DropdownMenuItem
                                                                        onClick={() => {
                                                                            setSelectedTermId(t.$id)
                                                                            openEditTerm(t)
                                                                        }}
                                                                    >
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        onClick={() => void setActiveTerm(t)}
                                                                        disabled={t.isActive}
                                                                    >
                                                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                                                        Set as Active
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        onClick={() => void toggleLockTerm(t)}
                                                                    >
                                                                        {t.isLocked ? (
                                                                            <>
                                                                                <Unlock className="mr-2 h-4 w-4" />
                                                                                Unlock Term
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Lock className="mr-2 h-4 w-4" />
                                                                                Lock Term
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuSeparator />

                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive"
                                                                        onClick={() => void deleteTerm(t)}
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>

                            {/* ===================== TIME BLOCKS TAB ===================== */}
                            <TabsContent value="time-blocks" className="min-w-0">
                                {!selectedTermId ? (
                                    <Alert>
                                        <AlertTitle>Select a term</AlertTitle>
                                        <AlertDescription>
                                            Choose an Academic Term to manage time blocks (calendars/time slots).
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-4 min-w-0">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <span>
                                                    Time blocks for{" "}
                                                    <span className="font-medium text-foreground">
                                                        {selectedTerm ? termLabel(selectedTerm) : "—"}
                                                    </span>
                                                </span>
                                            </div>

                                            <Button size="sm" onClick={openCreateBlock}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Time Block
                                            </Button>
                                        </div>

                                        {loadingTimeBlocks ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                            </div>
                                        ) : timeBlocks.length === 0 ? (
                                            <Alert>
                                                <AlertTitle>No time blocks</AlertTitle>
                                                <AlertDescription>
                                                    Create time blocks (e.g., Mon 8:00–9:00) for scheduling.
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <div className="rounded-lg border min-w-0 overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[22%]">Day</TableHead>
                                                            <TableHead className="w-[20%]">Start</TableHead>
                                                            <TableHead className="w-[20%]">End</TableHead>
                                                            <TableHead className="w-[26%]">Label</TableHead>
                                                            <TableHead className="w-[12%] text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {timeBlocks.map((b) => (
                                                            <TableRow key={b.$id}>
                                                                <TableCell className="font-medium">{b.dayOfWeek}</TableCell>
                                                                <TableCell>{b.startTime}</TableCell>
                                                                <TableCell>{b.endTime}</TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {b.label || "—"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon">
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-56">
                                                                            <DropdownMenuLabel>Block Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => openEditBlock(b)}>
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Edit
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onClick={() => void deleteBlock(b)}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>

                            {/* ===================== POLICIES TAB ===================== */}
                            <TabsContent value="policies" className="min-w-0">
                                {!selectedTermId ? (
                                    <Alert>
                                        <AlertTitle>Select a term</AlertTitle>
                                        <AlertDescription>
                                            Choose an Academic Term to configure scheduling policies like class duration.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-4 min-w-0">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                Policies apply to{" "}
                                                <span className="font-medium text-foreground">
                                                    {selectedTerm ? termLabel(selectedTerm) : "—"}
                                                </span>
                                            </div>

                                            <Button size="sm" onClick={openCreatePolicy}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Policy
                                            </Button>
                                        </div>

                                        <Card className="min-w-0">
                                            <CardHeader className="space-y-1">
                                                <CardTitle className="text-base">Recommended Policies</CardTitle>
                                                <CardDescription>
                                                    These are common scheduling parameters you can store per term.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="grid gap-3 md:grid-cols-2">
                                                {POLICY_PRESETS.map((p) => (
                                                    <div key={p.key} className="rounded-lg border p-3">
                                                        <div className="font-medium">{p.label}</div>
                                                        <div className="text-xs text-muted-foreground mt-1">{p.hint}</div>
                                                        <div className="mt-2">
                                                            <Badge variant="outline" className="font-mono">
                                                                {p.key}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </CardContent>
                                            <CardFooter className="text-xs text-muted-foreground">
                                                Tip: Use short keys for consistent scheduling logic in backend rules.
                                            </CardFooter>
                                        </Card>

                                        {loadingPolicies ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                            </div>
                                        ) : policies.length === 0 ? (
                                            <Alert>
                                                <AlertTitle>No policies yet</AlertTitle>
                                                <AlertDescription>
                                                    Create your first policy (example: class_duration_minutes = 60).
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <div className="rounded-lg border min-w-0 overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[34%]">Key</TableHead>
                                                            <TableHead className="w-[18%]">Value</TableHead>
                                                            <TableHead className="w-[36%]">Description</TableHead>
                                                            <TableHead className="w-[12%] text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {policies.map((p) => (
                                                            <TableRow key={p.$id}>
                                                                <TableCell className="font-mono text-sm">{p.key}</TableCell>
                                                                <TableCell className="font-medium">{p.value}</TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {p.description || "—"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon">
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-56">
                                                                            <DropdownMenuLabel>Policy Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => openEditPolicy(p)}>
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Edit
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onClick={() => void deletePolicy(p)}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* ===================== TERM DIALOG (WITH VERTICAL SCROLL) ===================== */}
                <Dialog open={termDialogOpen} onOpenChange={setTermDialogOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        {/* ✅ Vertical Scrollbar inside dialog content */}
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <DialogHeader>
                                <DialogTitle>{editingTerm ? "Edit Academic Term" : "Create Academic Term"}</DialogTitle>
                            </DialogHeader>

                            <div className="mt-4 grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="sy">School Year</Label>
                                    <Input
                                        id="sy"
                                        value={termSchoolYear}
                                        onChange={(e) => setTermSchoolYear(e.target.value)}
                                        placeholder="2025-2026"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Semester</Label>
                                    <Select value={termSemester} onValueChange={(v: any) => setTermSemester(v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose semester..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SEMESTERS.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {s}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label>Start Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="justify-start">
                                                    <CalendarDays className="mr-2 h-4 w-4" />
                                                    {termStartDate ? format(termStartDate, "PPP") : "Pick start date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-2" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={termStartDate}
                                                    onSelect={setTermStartDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="justify-start">
                                                    <CalendarDays className="mr-2 h-4 w-4" />
                                                    {termEndDate ? format(termEndDate, "PPP") : "Pick end date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-2" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={termEndDate}
                                                    onSelect={setTermEndDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid gap-3">
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <div className="font-medium">Active Term</div>
                                            <div className="text-xs text-muted-foreground">
                                                Only one term should be active at a time.
                                            </div>
                                        </div>
                                        <Switch checked={termIsActive} onCheckedChange={setTermIsActive} />
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <div className="font-medium">Locked</div>
                                            <div className="text-xs text-muted-foreground">
                                                Lock a term to prevent scheduling edits.
                                            </div>
                                        </div>
                                        <Switch checked={termIsLocked} onCheckedChange={setTermIsLocked} />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setTermDialogOpen(false)
                                        resetTermForm()
                                    }}
                                    disabled={savingTerm}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={() => void saveTerm()} disabled={savingTerm}>
                                    {savingTerm ? "Saving..." : "Save Term"}
                                </Button>
                            </DialogFooter>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

                {/* ===================== TIME BLOCK DIALOG (WITH VERTICAL SCROLL) ===================== */}
                <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        {/* ✅ Vertical Scrollbar inside dialog content */}
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <DialogHeader>
                                <DialogTitle>{editingBlock ? "Edit Time Block" : "Create Time Block"}</DialogTitle>
                            </DialogHeader>

                            <div className="mt-4 grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Day</Label>
                                    <Select value={blockDay} onValueChange={(v: any) => setBlockDay(v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose day..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DAYS.map((d) => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="start">Start Time</Label>
                                        <Input
                                            id="start"
                                            value={blockStartTime}
                                            onChange={(e) => setBlockStartTime(e.target.value)}
                                            placeholder="08:00"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="end">End Time</Label>
                                        <Input
                                            id="end"
                                            value={blockEndTime}
                                            onChange={(e) => setBlockEndTime(e.target.value)}
                                            placeholder="09:00"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="label">Label (optional)</Label>
                                    <Input
                                        id="label"
                                        value={blockLabel}
                                        onChange={(e) => setBlockLabel(e.target.value)}
                                        placeholder="AM Slot 1"
                                    />
                                </div>

                                <Separator />

                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <div className="font-medium">Enabled</div>
                                        <div className="text-xs text-muted-foreground">
                                            Disable a time block to hide it from schedule selection.
                                        </div>
                                    </div>
                                    <Switch checked={blockIsActive} onCheckedChange={setBlockIsActive} />
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setBlockDialogOpen(false)
                                        resetBlockForm()
                                    }}
                                    disabled={savingBlock}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={() => void saveBlock()} disabled={savingBlock}>
                                    {savingBlock ? "Saving..." : "Save Block"}
                                </Button>
                            </DialogFooter>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

                {/* ===================== POLICY DIALOG (WITH VERTICAL SCROLL) ===================== */}
                <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        {/* ✅ Vertical Scrollbar inside dialog content */}
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <DialogHeader>
                                <DialogTitle>{editingPolicy ? "Edit Policy" : "Create Policy"}</DialogTitle>
                            </DialogHeader>

                            <div className="mt-4 grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Policy Key</Label>
                                    <Select value={policyKey} onValueChange={setPolicyKey}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a policy key..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {POLICY_PRESETS.map((p) => (
                                                <SelectItem key={p.key} value={p.key}>
                                                    {p.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <div className="text-xs text-muted-foreground">
                                        Key stored as: <span className="font-mono">{policyKey}</span>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Value</Label>
                                    <Input
                                        value={policyValue}
                                        onChange={(e) => setPolicyValue(e.target.value)}
                                        placeholder={
                                            POLICY_PRESETS.find((x) => x.key === policyKey)?.placeholder ?? "Enter value..."
                                        }
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Description (optional)</Label>
                                    <Textarea
                                        value={policyDescription}
                                        onChange={(e) => setPolicyDescription(e.target.value)}
                                        placeholder="Short explanation for administrators..."
                                    />
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setPolicyDialogOpen(false)
                                        resetPolicyForm()
                                    }}
                                    disabled={savingPolicy}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={() => void savePolicy()} disabled={savingPolicy}>
                                    {savingPolicy ? "Saving..." : "Save Policy"}
                                </Button>
                            </DialogFooter>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
