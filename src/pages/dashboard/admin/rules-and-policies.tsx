/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    Plus,
    RefreshCcw,
    Pencil,
    Trash2,
    Save,
    SlidersHorizontal,
    ShieldCheck,
    ShieldAlert,
    Search,
    Settings2,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type PolicyType = "number" | "boolean" | "text" | "json"

type PolicyPreset = {
    section: "limits" | "schedule" | "conflicts" | "advanced"
    key: string
    label: string
    description: string
    type: PolicyType
    defaultValue: string
}

const GLOBAL_TERM_ID = "GLOBAL"

const PRESETS: PolicyPreset[] = [
    // LIMITS
    {
        section: "limits",
        key: "max_units_per_faculty",
        label: "Max Units per Faculty",
        description: "Hard cap on total units allowed per faculty workload for the selected term.",
        type: "number",
        defaultValue: "24",
    },
    {
        section: "limits",
        key: "max_hours_per_faculty",
        label: "Max Hours per Faculty",
        description: "Hard cap on total contact hours allowed per faculty workload for the selected term.",
        type: "number",
        defaultValue: "30",
    },

    // SCHEDULE WINDOWS
    {
        section: "schedule",
        key: "allowed_days",
        label: "Allowed Days",
        description: "Days allowed for scheduling. Used to block weekend/undesired days.",
        type: "json",
        defaultValue: JSON.stringify({ days: ["Mon", "Tue", "Wed", "Thu", "Fri"] }),
    },
    {
        section: "schedule",
        key: "allowed_time_window",
        label: "Allowed Time Window",
        description: "Earliest start and latest end time allowed in schedule generation.",
        type: "json",
        defaultValue: JSON.stringify({ start: "07:00", end: "19:00" }),
    },

    // CONFLICT RULES
    {
        section: "conflicts",
        key: "allow_faculty_conflict",
        label: "Allow Faculty Conflict",
        description: "If enabled, faculty can be assigned overlapping class meetings (NOT recommended).",
        type: "boolean",
        defaultValue: "false",
    },
    {
        section: "conflicts",
        key: "allow_room_conflict",
        label: "Allow Room Conflict",
        description: "If enabled, rooms may host overlapping meetings (NOT recommended).",
        type: "boolean",
        defaultValue: "false",
    },
    {
        section: "conflicts",
        key: "allow_section_conflict",
        label: "Allow Section Conflict",
        description: "If enabled, section students may have overlapping meetings (NOT recommended).",
        type: "boolean",
        defaultValue: "false",
    },

    // ADVANCED
    {
        section: "advanced",
        key: "conflict_grace_minutes",
        label: "Conflict Grace Minutes",
        description: "Optional buffer minutes used when checking overlaps (e.g., 5 minutes between meetings).",
        type: "number",
        defaultValue: "0",
    },
    {
        section: "advanced",
        key: "scheduler_notes",
        label: "Scheduler Notes",
        description: "Internal notes for admins/schedulers (stored as policy value).",
        type: "text",
        defaultValue: "",
    },
]

function asBool(v: any) {
    const s = String(v ?? "").trim().toLowerCase()
    return s === "true" || s === "1" || s === "yes"
}

function safeJsonParse<T = any>(raw: string, fallback: T): T {
    try {
        const v = JSON.parse(raw)
        return v ?? fallback
    } catch {
        return fallback
    }
}

function fmtTermLabel(t: any) {
    const sy = String(t?.schoolYear ?? "").trim()
    const sem = String(t?.semester ?? "").trim()
    const name = [sy, sem].filter(Boolean).join(" • ")
    return name || t?.$id || "Academic Term"
}

type EditDraft = {
    mode: "create" | "edit"
    id?: string
    termId: string
    key: string
    value: string
    description: string
    typeHint: PolicyType
}

export default function AdminRulesAndPoliciesPage() {
    const [terms, setTerms] = React.useState<any[]>([])
    const [termId, setTermId] = React.useState<string>(GLOBAL_TERM_ID)

    const [loading, setLoading] = React.useState(false)
    const [saving, setSaving] = React.useState(false)

    const [policies, setPolicies] = React.useState<any[]>([])
    const [query, setQuery] = React.useState("")

    // preset local state (quick config)
    const [presetValues, setPresetValues] = React.useState<Record<string, string>>({})

    // dialogs
    const [openEditor, setOpenEditor] = React.useState(false)
    const [draft, setDraft] = React.useState<EditDraft | null>(null)

    const [deleteId, setDeleteId] = React.useState<string | null>(null)

    const activeTerm = React.useMemo(() => {
        const found = terms.find((t) => t?.isActive)
        return found || null
    }, [terms])

    // load terms
    React.useEffect(() => {
        let alive = true

        const run = async () => {
            setLoading(true)
            try {
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    [Query.orderDesc("$createdAt"), Query.limit(50)]
                )

                const list = Array.isArray(res?.documents) ? res.documents : []
                if (!alive) return

                setTerms(list)

                if (termId === GLOBAL_TERM_ID && list.some((t: any) => t?.isActive)) {
                    // keep global
                } else if (!termId && list.some((t: any) => t?.isActive)) {
                    const t = list.find((x: any) => x?.isActive)
                    if (t?.$id) setTermId(String(t.$id))
                }
            } catch (e: any) {
                toast.error(e?.message || "Failed to load academic terms")
            } finally {
                if (alive) setLoading(false)
            }
        }

        void run()

        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchPolicies = React.useCallback(async () => {
        setLoading(true)
        try {
            const res = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SYSTEM_POLICIES,
                [
                    Query.equal("termId", termId),
                    Query.orderAsc("key"),
                    Query.limit(200),
                ]
            )

            const list = Array.isArray(res?.documents) ? res.documents : []
            setPolicies(list)

            // hydrate presets
            const map: Record<string, string> = {}
            PRESETS.forEach((p) => {
                const doc = list.find((d: any) => String(d?.key) === p.key)
                map[p.key] = doc?.value != null ? String(doc.value) : p.defaultValue
            })
            setPresetValues(map)
        } catch (e: any) {
            toast.error(e?.message || "Failed to load system policies")
        } finally {
            setLoading(false)
        }
    }, [termId])

    React.useEffect(() => {
        void fetchPolicies()
    }, [fetchPolicies])

    const upsertPolicy = React.useCallback(
        async (payload: { key: string; value: string; description?: string }) => {
            const key = String(payload.key || "").trim()
            if (!key) throw new Error("Policy key is required")

            const value = String(payload.value ?? "")
            const description = String(payload.description ?? "")

            // find existing (termId + key)
            const existing = policies.find(
                (p: any) => String(p?.termId) === String(termId) && String(p?.key) === key
            )

            if (existing?.$id) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.SYSTEM_POLICIES,
                    existing.$id,
                    {
                        termId,
                        key,
                        value,
                        description,
                    }
                )
                return
            }

            await databases.createDocument(DATABASE_ID, COLLECTIONS.SYSTEM_POLICIES, ID.unique(), {
                termId,
                key,
                value,
                description,
            })
        },
        [policies, termId]
    )

    const removePolicy = React.useCallback(
        async (id: string) => {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SYSTEM_POLICIES, id)
        },
        []
    )

    const openCreate = () => {
        setDraft({
            mode: "create",
            termId,
            key: "",
            value: "",
            description: "",
            typeHint: "text",
        })
        setOpenEditor(true)
    }

    const openEdit = (doc: any) => {
        setDraft({
            mode: "edit",
            id: String(doc?.$id),
            termId: String(doc?.termId ?? termId),
            key: String(doc?.key ?? ""),
            value: String(doc?.value ?? ""),
            description: String(doc?.description ?? ""),
            typeHint: (() => {
                const val = String(doc?.value ?? "")
                if (val.trim().startsWith("{") || val.trim().startsWith("[")) return "json"
                if (val === "true" || val === "false") return "boolean"
                if (Number.isFinite(Number(val)) && val.trim() !== "") return "number"
                return "text"
            })(),
        })
        setOpenEditor(true)
    }

    const saveDraft = async () => {
        if (!draft) return

        const key = String(draft.key || "").trim()
        if (!key) {
            toast.error("Policy key is required")
            return
        }

        setSaving(true)
        try {
            if (draft.mode === "edit" && draft.id) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.SYSTEM_POLICIES,
                    draft.id,
                    {
                        termId: termId,
                        key,
                        value: String(draft.value ?? ""),
                        description: String(draft.description ?? ""),
                    }
                )
            } else {
                await upsertPolicy({
                    key,
                    value: String(draft.value ?? ""),
                    description: String(draft.description ?? ""),
                })
            }

            toast.success("Policy saved")
            setOpenEditor(false)
            setDraft(null)
            await fetchPolicies()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save policy")
        } finally {
            setSaving(false)
        }
    }

    const presetSection = React.useMemo(() => {
        return {
            limits: PRESETS.filter((p) => p.section === "limits"),
            schedule: PRESETS.filter((p) => p.section === "schedule"),
            conflicts: PRESETS.filter((p) => p.section === "conflicts"),
            advanced: PRESETS.filter((p) => p.section === "advanced"),
        }
    }, [])

    const configuredCount = React.useMemo(() => {
        const presetKeys = new Set(PRESETS.map((p) => p.key))
        const set = new Set<string>()
        for (const p of policies) {
            const k = String(p?.key ?? "")
            if (presetKeys.has(k)) set.add(k)
        }
        return set.size
    }, [policies])

    const completeness = React.useMemo(() => {
        if (PRESETS.length === 0) return 0
        return Math.min(100, Math.round((configuredCount / PRESETS.length) * 100))
    }, [configuredCount])

    const savePresetSection = async (sectionKey: PolicyPreset["section"]) => {
        setSaving(true)
        try {
            const list = PRESETS.filter((p) => p.section === sectionKey)

            for (const p of list) {
                const v = presetValues[p.key] ?? p.defaultValue

                if (p.type === "number") {
                    const n = Number(v)
                    if (!Number.isFinite(n)) throw new Error(`${p.label}: invalid number`)
                }
                if (p.type === "json") {
                    safeJsonParse(v, null)
                }

                await upsertPolicy({
                    key: p.key,
                    value: String(v),
                    description: p.description,
                })
            }

            toast.success("Policies saved")
            await fetchPolicies()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save preset policies")
        } finally {
            setSaving(false)
        }
    }

    const resetToDefaults = async () => {
        setSaving(true)
        try {
            const presetKeys = new Set(PRESETS.map((p) => p.key))
            const toDelete = policies.filter((p: any) => presetKeys.has(String(p?.key ?? "")))

            for (const doc of toDelete) {
                if (doc?.$id) {
                    await removePolicy(String(doc.$id))
                }
            }

            toast.success("Reset completed")
            await fetchPolicies()
        } catch (e: any) {
            toast.error(e?.message || "Failed to reset policies")
        } finally {
            setSaving(false)
        }
    }

    const filteredPolicies = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return policies

        return policies.filter((p: any) => {
            const k = String(p?.key ?? "").toLowerCase()
            const d = String(p?.description ?? "").toLowerCase()
            const v = String(p?.value ?? "").toLowerCase()
            return k.includes(q) || d.includes(q) || v.includes(q)
        })
    }, [policies, query])

    const termBadge = React.useMemo(() => {
        if (termId === GLOBAL_TERM_ID) return "Global"
        const t = terms.find((x) => String(x?.$id) === String(termId))
        return t ? fmtTermLabel(t) : "Term"
    }, [termId, terms])

    const allowedDays = React.useMemo(() => {
        const raw =
            presetValues["allowed_days"] ??
            PRESETS.find((p) => p.key === "allowed_days")?.defaultValue ??
            ""
        const parsed = safeJsonParse(raw, { days: [] as string[] })
        return Array.isArray(parsed?.days) ? parsed.days : []
    }, [presetValues])

    const allowedWindow = React.useMemo(() => {
        const raw =
            presetValues["allowed_time_window"] ??
            PRESETS.find((p) => p.key === "allowed_time_window")?.defaultValue ??
            ""
        return safeJsonParse(raw, { start: "07:00", end: "19:00" })
    }, [presetValues])

    const setDayChecked = (day: string, checked: boolean) => {
        const current = new Set(allowedDays)
        if (checked) current.add(day)
        else current.delete(day)

        const next = JSON.stringify({ days: Array.from(current) })
        setPresetValues((s) => ({ ...s, allowed_days: next }))
    }

    const setTimeWindow = (patch: Partial<{ start: string; end: string }>) => {
        const next = JSON.stringify({
            start: patch.start ?? allowedWindow.start,
            end: patch.end ?? allowedWindow.end,
        })
        setPresetValues((s) => ({ ...s, allowed_time_window: next }))
    }

    return (
        <DashboardLayout
            title="System Rules & Policies"
            subtitle="Configure workload limits, allowed schedule windows, and conflict rules for scheduling."
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void fetchPolicies()}
                        disabled={loading}
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>

                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Policy
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6">
                <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <SlidersHorizontal className="h-5 w-5" />
                                        Quick Configuration
                                    </CardTitle>
                                    <CardDescription>
                                        Apply common scheduling policies fast. Policies are stored in Appwrite under{" "}
                                        <Badge variant="secondary">system_policies</Badge>.
                                    </CardDescription>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="truncate">
                                        {termBadge}
                                    </Badge>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Label className="shrink-0">Target Term</Label>
                                    <Select value={termId} onValueChange={(v) => setTermId(v)}>
                                        <SelectTrigger className="w-full sm:w-80">
                                            <SelectValue placeholder="Select term" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={GLOBAL_TERM_ID}>
                                                Global (applies to all)
                                            </SelectItem>

                                            {terms.map((t: any) => (
                                                <SelectItem key={t?.$id} value={String(t?.$id)}>
                                                    {fmtTermLabel(t)}
                                                    {t?.isActive ? " — Active" : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="min-w-40">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Preset coverage</span>
                                            <span>{completeness}%</span>
                                        </div>
                                        <Progress value={completeness} />
                                    </div>

                                    <Badge variant={completeness >= 80 ? "default" : "secondary"}>
                                        {configuredCount}/{PRESETS.length} configured
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <Tabs defaultValue="limits" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="limits">
                                        <Settings2 className="mr-2 h-4 w-4" />
                                        Limits
                                    </TabsTrigger>
                                    <TabsTrigger value="schedule">
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        Schedule
                                    </TabsTrigger>
                                    <TabsTrigger value="conflicts">
                                        <ShieldAlert className="mr-2 h-4 w-4" />
                                        Conflicts
                                    </TabsTrigger>
                                    <TabsTrigger value="advanced">
                                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                                        Advanced
                                    </TabsTrigger>
                                </TabsList>

                                {/* LIMITS */}
                                <TabsContent value="limits" className="space-y-4">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Max Units</CardTitle>
                                                <CardDescription>
                                                    Prevent overload by limiting total units per faculty.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Max Units</Label>
                                                        <Badge variant="secondary">
                                                            {Number(presetValues["max_units_per_faculty"] ?? 24)}
                                                        </Badge>
                                                    </div>

                                                    <Slider
                                                        value={[
                                                            Number(
                                                                presetValues["max_units_per_faculty"] ??
                                                                PRESETS.find((p) => p.key === "max_units_per_faculty")
                                                                    ?.defaultValue ??
                                                                24
                                                            ),
                                                        ]}
                                                        onValueChange={(v) => {
                                                            const n = v?.[0] ?? 24
                                                            setPresetValues((s) => ({
                                                                ...s,
                                                                max_units_per_faculty: String(n),
                                                            }))
                                                        }}
                                                        min={6}
                                                        max={40}
                                                        step={1}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Manual input</Label>
                                                    <Input
                                                        inputMode="numeric"
                                                        value={presetValues["max_units_per_faculty"] ?? ""}
                                                        onChange={(e) =>
                                                            setPresetValues((s) => ({
                                                                ...s,
                                                                max_units_per_faculty: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="e.g. 24"
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Max Hours</CardTitle>
                                                <CardDescription>
                                                    Set maximum contact hours per faculty in a term.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Max Hours</Label>
                                                        <Badge variant="secondary">
                                                            {Number(presetValues["max_hours_per_faculty"] ?? 30)}
                                                        </Badge>
                                                    </div>

                                                    <Slider
                                                        value={[
                                                            Number(
                                                                presetValues["max_hours_per_faculty"] ??
                                                                PRESETS.find((p) => p.key === "max_hours_per_faculty")
                                                                    ?.defaultValue ??
                                                                30
                                                            ),
                                                        ]}
                                                        onValueChange={(v) => {
                                                            const n = v?.[0] ?? 30
                                                            setPresetValues((s) => ({
                                                                ...s,
                                                                max_hours_per_faculty: String(n),
                                                            }))
                                                        }}
                                                        min={6}
                                                        max={50}
                                                        step={1}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Manual input</Label>
                                                    <Input
                                                        inputMode="numeric"
                                                        value={presetValues["max_hours_per_faculty"] ?? ""}
                                                        onChange={(e) =>
                                                            setPresetValues((s) => ({
                                                                ...s,
                                                                max_hours_per_faculty: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="e.g. 30"
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const next = { ...presetValues }
                                                presetSection.limits.forEach((p) => {
                                                    next[p.key] = p.defaultValue
                                                })
                                                setPresetValues(next)
                                                toast.success("Limits reset (local)")
                                            }}
                                        >
                                            Reset (Local)
                                        </Button>

                                        <Button
                                            onClick={() => void savePresetSection("limits")}
                                            disabled={saving}
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Limits
                                        </Button>
                                    </div>
                                </TabsContent>

                                {/* SCHEDULE */}
                                <TabsContent value="schedule" className="space-y-4">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Allowed Days</CardTitle>
                                                <CardDescription>
                                                    Select which days the scheduler can place meetings.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
                                                        const checked = allowedDays.includes(d)
                                                        return (
                                                            <label
                                                                key={d}
                                                                className={cn(
                                                                    "flex items-center gap-2 rounded-xl border p-3 cursor-pointer",
                                                                    checked && "bg-muted"
                                                                )}
                                                            >
                                                                <Checkbox
                                                                    checked={checked}
                                                                    onCheckedChange={(v) => setDayChecked(d, Boolean(v))}
                                                                />
                                                                <span className="text-sm">{d}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>

                                                <div className="rounded-xl border p-3 text-xs text-muted-foreground">
                                                    Stored as JSON:
                                                    <div className="mt-2 font-mono text-[11px] break-all">
                                                        {presetValues["allowed_days"] ?? ""}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Allowed Time Window</CardTitle>
                                                <CardDescription>
                                                    Restrict schedule meetings between an earliest start and latest end.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <div className="space-y-1.5">
                                                        <Label>Earliest Start</Label>
                                                        <Input
                                                            value={String(allowedWindow?.start ?? "07:00")}
                                                            onChange={(e) => setTimeWindow({ start: e.target.value })}
                                                            placeholder="07:00"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Label>Latest End</Label>
                                                        <Input
                                                            value={String(allowedWindow?.end ?? "19:00")}
                                                            onChange={(e) => setTimeWindow({ end: e.target.value })}
                                                            placeholder="19:00"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border p-3 text-xs text-muted-foreground">
                                                    Stored as JSON:
                                                    <div className="mt-2 font-mono text-[11px] break-all">
                                                        {presetValues["allowed_time_window"] ?? ""}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const next = { ...presetValues }
                                                presetSection.schedule.forEach((p) => {
                                                    next[p.key] = p.defaultValue
                                                })
                                                setPresetValues(next)
                                                toast.success("Schedule rules reset (local)")
                                            }}
                                        >
                                            Reset (Local)
                                        </Button>

                                        <Button
                                            onClick={() => void savePresetSection("schedule")}
                                            disabled={saving}
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Schedule Rules
                                        </Button>
                                    </div>
                                </TabsContent>

                                {/* CONFLICTS */}
                                <TabsContent value="conflicts" className="space-y-4">
                                    <div className="grid gap-4 lg:grid-cols-3">
                                        {presetSection.conflicts.map((p) => {
                                            const checked = asBool(presetValues[p.key] ?? p.defaultValue)

                                            return (
                                                <Card key={p.key}>
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{p.label}</CardTitle>
                                                        <CardDescription>{p.description}</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="flex items-center justify-between gap-3">
                                                        <div className="text-sm text-muted-foreground">
                                                            {checked ? (
                                                                <Badge variant="destructive">Enabled</Badge>
                                                            ) : (
                                                                <Badge variant="secondary">Disabled</Badge>
                                                            )}
                                                        </div>

                                                        <Switch
                                                            checked={checked}
                                                            onCheckedChange={(v) =>
                                                                setPresetValues((s) => ({
                                                                    ...s,
                                                                    [p.key]: String(Boolean(v)),
                                                                }))
                                                            }
                                                        />
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>

                                    <Alert>
                                        <ShieldAlert className="h-4 w-4" />
                                        <AlertTitle>Recommendation</AlertTitle>
                                        <AlertDescription>
                                            Keep conflicts <b>disabled</b> to ensure schedules are valid and no overlaps occur.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const next = { ...presetValues }
                                                presetSection.conflicts.forEach((p) => {
                                                    next[p.key] = p.defaultValue
                                                })
                                                setPresetValues(next)
                                                toast.success("Conflict rules reset (local)")
                                            }}
                                        >
                                            Reset (Local)
                                        </Button>

                                        <Button
                                            onClick={() => void savePresetSection("conflicts")}
                                            disabled={saving}
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Conflict Rules
                                        </Button>
                                    </div>
                                </TabsContent>

                                {/* ADVANCED */}
                                <TabsContent value="advanced" className="space-y-4">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Conflict Grace Minutes</CardTitle>
                                                <CardDescription>
                                                    Optional buffer minutes for overlap checks. Example: 5 minutes for hallway transitions.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label>Minutes</Label>
                                                    <Badge variant="secondary">
                                                        {Number(presetValues["conflict_grace_minutes"] ?? 0)}
                                                    </Badge>
                                                </div>

                                                <Slider
                                                    value={[
                                                        Number(
                                                            presetValues["conflict_grace_minutes"] ??
                                                            PRESETS.find((p) => p.key === "conflict_grace_minutes")
                                                                ?.defaultValue ??
                                                            0
                                                        ),
                                                    ]}
                                                    onValueChange={(v) => {
                                                        const n = v?.[0] ?? 0
                                                        setPresetValues((s) => ({
                                                            ...s,
                                                            conflict_grace_minutes: String(n),
                                                        }))
                                                    }}
                                                    min={0}
                                                    max={30}
                                                    step={1}
                                                />

                                                <Input
                                                    inputMode="numeric"
                                                    value={presetValues["conflict_grace_minutes"] ?? ""}
                                                    onChange={(e) =>
                                                        setPresetValues((s) => ({
                                                            ...s,
                                                            conflict_grace_minutes: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="0"
                                                />
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Scheduler Notes</CardTitle>
                                                <CardDescription>
                                                    Internal notes (stored as a policy value).
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <Textarea
                                                    value={presetValues["scheduler_notes"] ?? ""}
                                                    onChange={(e) =>
                                                        setPresetValues((s) => ({
                                                            ...s,
                                                            scheduler_notes: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Write internal notes here..."
                                                    className="min-h-28"
                                                />
                                                <div className="text-xs text-muted-foreground">
                                                    Tip: Use this for department-wide rules, reminders, or special exemptions.
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const next = { ...presetValues }
                                                presetSection.advanced.forEach((p) => {
                                                    next[p.key] = p.defaultValue
                                                })
                                                setPresetValues(next)
                                                toast.success("Advanced reset (local)")
                                            }}
                                        >
                                            Reset (Local)
                                        </Button>

                                        <Button
                                            onClick={() => void savePresetSection("advanced")}
                                            disabled={saving}
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Advanced
                                        </Button>
                                    </div>

                                    <Card className="border-destructive/30">
                                        <CardHeader>
                                            <CardTitle className="text-base">Danger Zone</CardTitle>
                                            <CardDescription>
                                                Reset ONLY preset policies to their defaults (custom policies remain).
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                This deletes all preset keys under this selected target term.
                                            </div>
                                            <Button
                                                variant="destructive"
                                                onClick={() => void resetToDefaults()}
                                                disabled={saving}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Reset Presets
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5" />
                                Policy Tips
                            </CardTitle>
                            <CardDescription>
                                Keep policies consistent to avoid unexpected schedule conflicts.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <Alert>
                                <AlertTitle>Recommended Defaults</AlertTitle>
                                <AlertDescription>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span>Max units per faculty</span>
                                            <Badge variant="secondary">24</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Max hours per faculty</span>
                                            <Badge variant="secondary">30</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Allowed days</span>
                                            <Badge variant="secondary">Mon–Fri</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Conflicts</span>
                                            <Badge variant="secondary">Disabled</Badge>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>

                            <Separator />

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Active Term</div>
                                <div className="text-sm text-muted-foreground">
                                    {activeTerm ? fmtTermLabel(activeTerm) : "No active term detected."}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">
                                        Target: {termBadge}
                                    </Badge>
                                    <Badge variant="secondary">
                                        Collection: system_policies
                                    </Badge>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <div className="text-sm font-medium">How values are stored</div>
                                <div className="text-sm text-muted-foreground">
                                    Each policy is a simple key-value pair. Values can be plain text, numbers, booleans, or JSON.
                                </div>
                                <div className="rounded-xl border p-3 text-xs font-mono break-all text-muted-foreground">
                                    {"{ termId: '...', key: 'max_units_per_faculty', value: '24' }"}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <CardTitle>All Policies</CardTitle>
                                <CardDescription>
                                    View, search, edit, and delete policies stored under the selected target term.
                                </CardDescription>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search key, value, or description..."
                                        className="pl-9"
                                    />
                                </div>

                                <Button variant="outline" onClick={() => setQuery("")}>
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {/* ✅ Horizontal Scrollbar Added */}
                        <ScrollArea className="h-105 rounded-xl border">
                            <div className="min-w-240">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-55">Key</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead className="w-85">Description</TableHead>
                                            <TableHead className="w-55 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                                    Loading policies...
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredPolicies.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                                    No policies found for this term.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredPolicies.map((p: any) => {
                                                const isPreset = PRESETS.some((x) => x.key === String(p?.key))
                                                return (
                                                    <TableRow key={p?.$id}>
                                                        <TableCell className="align-top">
                                                            <div className="flex items-start gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="font-medium truncate">
                                                                        {String(p?.key ?? "")}
                                                                    </div>
                                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                                        {isPreset ? (
                                                                            <Badge variant="secondary">Preset</Badge>
                                                                        ) : (
                                                                            <Badge variant="outline">Custom</Badge>
                                                                        )}
                                                                        <Badge variant="outline" className="truncate">
                                                                            {termBadge}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="space-y-2">
                                                                <div className="text-sm wrap-break-word">
                                                                    {String(p?.value ?? "") || (
                                                                        <span className="text-muted-foreground">—</span>
                                                                    )}
                                                                </div>
                                                                {String(p?.value ?? "").trim().startsWith("{") ? (
                                                                    <Badge variant="outline">JSON</Badge>
                                                                ) : null}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="text-sm text-muted-foreground wrap-break-word">
                                                                {String(p?.description ?? "") || "—"}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm">
                                                                        Actions
                                                                    </Button>
                                                                </DropdownMenuTrigger>

                                                                <DropdownMenuContent align="end" className="w-40">
                                                                    <DropdownMenuLabel>Policy</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />

                                                                    <DropdownMenuItem onClick={() => openEdit(p)}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive"
                                                                        onClick={() => setDeleteId(String(p?.$id))}
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* ✅ Horizontal scrollbar */}
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>

                        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                            <div>
                                Showing <b className="text-foreground">{filteredPolicies.length}</b> item(s)
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">{termBadge}</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* EDITOR DIALOG */}
                <Dialog open={openEditor} onOpenChange={setOpenEditor}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {draft?.mode === "edit" ? "Edit Policy" : "Create Policy"}
                            </DialogTitle>
                            <DialogDescription>
                                Store a rule under <Badge variant="secondary">system_policies</Badge> for{" "}
                                <Badge variant="outline">{termBadge}</Badge>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Policy Key</Label>
                                <Input
                                    value={draft?.key ?? ""}
                                    onChange={(e) => setDraft((s) => (s ? { ...s, key: e.target.value } : s))}
                                    placeholder="e.g. max_units_per_faculty"
                                    disabled={draft?.mode === "edit"}
                                />
                                <div className="text-xs text-muted-foreground">
                                    Tip: Use snake_case keys. Keys should remain stable over time.
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Value</Label>
                                <Textarea
                                    value={draft?.value ?? ""}
                                    onChange={(e) => setDraft((s) => (s ? { ...s, value: e.target.value } : s))}
                                    placeholder="String, number, boolean, or JSON..."
                                    className="min-h-28"
                                />
                                <div className="text-xs text-muted-foreground">
                                    JSON example: {"{ \"days\": [\"Mon\",\"Tue\"] }"}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={draft?.description ?? ""}
                                    onChange={(e) =>
                                        setDraft((s) => (s ? { ...s, description: e.target.value } : s))
                                    }
                                    placeholder="What does this policy do?"
                                    className="min-h-20"
                                />
                            </div>
                        </div>

                        {/* ✅ Space between buttons fixed */}
                        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setOpenEditor(false)
                                    setDraft(null)
                                }}
                                disabled={saving}
                            >
                                Cancel
                            </Button>

                            <Button onClick={() => void saveDraft()} disabled={saving}>
                                <Save className="mr-2 h-4 w-4" />
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* DELETE CONFIRM */}
                <Dialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Delete Policy</DialogTitle>
                            <DialogDescription>
                                This action cannot be undone. The policy will be removed from Appwrite.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                            Policy ID: <span className="font-mono text-foreground">{deleteId}</span>
                        </div>

                        {/* ✅ Space between buttons fixed */}
                        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setDeleteId(null)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (!deleteId) return

                                    const run = async () => {
                                        setSaving(true)
                                        try {
                                            await removePolicy(deleteId)
                                            toast.success("Policy deleted")
                                            setDeleteId(null)
                                            await fetchPolicies()
                                        } catch (e: any) {
                                            toast.error(e?.message || "Failed to delete policy")
                                        } finally {
                                            setSaving(false)
                                        }
                                    }

                                    void run()
                                }}
                                disabled={saving}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
