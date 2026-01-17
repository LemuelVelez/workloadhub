
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    CheckCircle2,
    Clock,
    Mail,
    MoreHorizontal,
    Plus,
    RefreshCw,
    ShieldCheck,
    Trash2,
    UserMinus,
    UserPlus2,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { adminApi } from "@/api/admin"

import { cn } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type AdminUserRole = "ADMIN" | "CHAIR" | "FACULTY"

type DepartmentLite = {
    $id: string
    code: string
    name: string
    isActive: boolean
}

type UserDoc = {
    $id: string
    userId?: string
    email: string
    name?: string | null
    role: string
    departmentId?: string | null
    isActive: boolean
    $createdAt: string
    $updatedAt: string
}

type UserFormState = {
    $id?: string
    userId?: string
    email: string
    name: string
    role: AdminUserRole
    departmentId: string
    isActive: boolean
}

const ROLE_OPTIONS: { value: AdminUserRole; label: string }[] = [
    { value: "ADMIN", label: "Admin" },
    { value: "CHAIR", label: "Dept Head" },
    { value: "FACULTY", label: "Faculty" },
]

function roleLabel(r: string) {
    const found = ROLE_OPTIONS.find((x) => x.value === r)
    return found?.label || r
}

function roleBadgeVariant(role: string): "secondary" | "default" | "destructive" {
    if (role === "ADMIN") return "default"
    if (role === "CHAIR") return "secondary"
    return "secondary"
}

function initials(nameOrEmail: string) {
    const s = (nameOrEmail || "").trim()
    if (!s) return "U"
    const parts = s.split(" ").filter(Boolean)
    const first = parts[0]?.[0] ?? "U"
    const second = parts[1]?.[0] ?? ""
    return (first + second).toUpperCase()
}

function normalizeSearch(s: string) {
    return (s || "").toLowerCase().trim()
}

function canHaveDepartment(role: AdminUserRole) {
    return role === "CHAIR" || role === "FACULTY"
}

function emptyForm(): UserFormState {
    return {
        email: "",
        name: "",
        role: "FACULTY",
        departmentId: "",
        isActive: true,
    }
}

const RESEND_COOLDOWN_MS = 30_000
const RESEND_SUCCESS_BADGE_MS = 5_000

export default function AdminUsersPage() {
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [rows, setRows] = React.useState<UserDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentLite[]>([])

    const [q, setQ] = React.useState("")
    const [includeInactive, setIncludeInactive] = React.useState(true)

    const [openForm, setOpenForm] = React.useState(false)
    const [openDelete, setOpenDelete] = React.useState(false)

    const [form, setForm] = React.useState<UserFormState>(emptyForm())
    const [target, setTarget] = React.useState<UserDoc | null>(null)

    const [rolePickerOpen, setRolePickerOpen] = React.useState(false)
    const [deptPickerOpen, setDeptPickerOpen] = React.useState(false)

    const [resending, setResending] = React.useState<Record<string, boolean>>({})
    const [openResend, setOpenResend] = React.useState(false)
    const [resendTarget, setResendTarget] = React.useState<UserDoc | null>(null)

    const [cooldowns, setCooldowns] = React.useState<Record<string, number>>({})
    const [sentBadgeAt, setSentBadgeAt] = React.useState<Record<string, number>>({})

    const [now, setNow] = React.useState(() => Date.now())
    React.useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [])

    /**
     * ✅ First Login Status from Appwrite table: first_login_users
     * Map format:
     * {
     *   [userId]: { completed: boolean, mustChangePassword: boolean, rowId?: string }
     * }
     */
    const [firstLoginMap, setFirstLoginMap] = React.useState<
        Record<string, { completed: boolean; mustChangePassword: boolean; rowId?: string }>
    >({})

    const deptMap = React.useMemo(() => {
        const m = new Map<string, DepartmentLite>()
        for (const d of departments) m.set(d.$id, d)
        return m
    }, [departments])

    const filtered = React.useMemo(() => {
        const term = normalizeSearch(q)
        const base = includeInactive ? rows : rows.filter((r) => r.isActive)

        if (!term) return base

        return base.filter((r) => {
            const hay = [
                r.userId || "",
                r.email,
                r.name || "",
                r.role,
                deptMap.get(r.departmentId || "")?.name || "",
                deptMap.get(r.departmentId || "")?.code || "",
            ]
                .join(" ")
                .toLowerCase()
            return hay.includes(term)
        })
    }, [rows, q, includeInactive, deptMap])

    const firstLoginStats = React.useMemo(() => {
        let pending = 0

        for (const u of rows) {
            const safeUserId = String(u.userId || "").trim()
            if (!safeUserId) continue

            const st = firstLoginMap[safeUserId]
            const isPending = st ? (!st.completed || st.mustChangePassword) : false
            if (isPending) pending++
        }

        return {
            pending,
            completed: Math.max(0, rows.length - pending),
        }
    }, [rows, firstLoginMap])

    async function loadAll() {
        setLoading(true)
        setError(null)

        try {
            const [deps, users] = await Promise.all([
                adminApi.departments.listLite({ activeOnly: true }),
                adminApi.users.list({ includeInactive: true, limit: 200 }),
            ])

            setDepartments(deps || [])
            setRows(users || [])

            // ✅ Fetch first-login status ONLY for the listed users (fast + correct)
            const userIds = Array.from(
                new Set(
                    (users || [])
                        .map((u: any) => String(u?.userId || "").trim())
                        .filter(Boolean)
                )
            )

            const statusMap =
                (await adminApi.firstLoginUsers?.statusMap?.(userIds).catch(() => ({}))) || {}

            setFirstLoginMap(statusMap)
        } catch (e: any) {
            setError(e?.message || "Failed to load users.")
            setRows([])
            setDepartments([])
            setFirstLoginMap({})
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        void loadAll()
    }, [])

    function openCreate() {
        setTarget(null)
        setForm(emptyForm())
        setOpenForm(true)
    }

    function openEdit(it: UserDoc) {
        setTarget(it)
        setForm({
            $id: it.$id,
            userId: it.userId || it.$id || "",
            email: it.email || "",
            name: it.name || "",
            role: (it.role as AdminUserRole) || "FACULTY",
            departmentId: it.departmentId || "",
            isActive: Boolean(it.isActive),
        })
        setOpenForm(true)
    }

    function openDeleteConfirm(it: UserDoc) {
        setTarget(it)
        setOpenDelete(true)
    }

    async function saveForm() {
        const email = form.email.trim().toLowerCase()
        const name = form.name.trim()
        const role = form.role
        const departmentId = form.departmentId.trim()
        const isActive = Boolean(form.isActive)

        if (!email) {
            toast.error("Email is required.")
            return
        }
        if (!role) {
            toast.error("Role is required.")
            return
        }

        const deptNeeded = canHaveDepartment(role)
        if (deptNeeded && !departmentId) {
            toast.error("Department is required for this role.")
            return
        }

        setSaving(true)

        try {
            if (form.$id) {
                await adminApi.users.update(form.$id, {
                    userId: form.userId || "",
                    email,
                    name: name || null,
                    role,
                    departmentId: deptNeeded ? departmentId : null,
                    isActive,
                })
                toast.success("User updated.")
            } else {
                await adminApi.users.create({
                    email,
                    name: name || null,
                    role,
                    departmentId: deptNeeded ? departmentId : null,
                    isActive,
                } as any)

                toast.success("User created. Login credentials were sent to the user via email.")
            }

            setOpenForm(false)
            setForm(emptyForm())
            await loadAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save user.")
        } finally {
            setSaving(false)
        }
    }

    /**
     * ✅ Activate/Deactivate updates BOTH:
     * - USER_PROFILES.isActive
     * - Appwrite Auth status (blocks/allow login)
     */
    async function toggleActive(it: UserDoc) {
        const safeUserId = String(it.userId || it.$id || "").trim()
        if (!safeUserId) {
            toast.error("Missing userId. Please refresh and try again.")
            return
        }

        try {
            await adminApi.users.setActive({
                docId: it.$id,
                userId: safeUserId,
                isActive: !it.isActive,
            })

            toast.success(it.isActive ? "User deactivated (login blocked)." : "User activated (login enabled).")
            await loadAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update status.")
        }
    }

    /**
     * ✅ deleting removes BOTH:
     * - USER_PROFILES row
     * - Appwrite Auth user
     */
    async function deleteNow() {
        if (!target) return

        const safeUserId = String(target.userId || target.$id || "").trim()
        if (!safeUserId) {
            toast.error("Missing userId. Please refresh and try again.")
            return
        }

        try {
            await adminApi.users.remove({
                docId: target.$id,
                userId: safeUserId,
            })

            toast.success("User deleted (Profile + Appwrite Auth).")
            setOpenDelete(false)
            setTarget(null)
            await loadAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete user.")
        }
    }

    function getCooldownRemainingSeconds(rowId: string) {
        const until = cooldowns[rowId] || 0
        const remaining = Math.max(0, Math.ceil((until - now) / 1000))
        return remaining
    }

    function openResendConfirm(it: UserDoc) {
        if (!it.isActive) {
            toast.error("Cannot resend credentials for an inactive user.")
            return
        }

        const remaining = getCooldownRemainingSeconds(it.$id)
        if (remaining > 0) {
            toast.info(`Please wait ${remaining}s before resending again.`)
            return
        }

        setResendTarget(it)
        setOpenResend(true)
    }

    function closeResendConfirm() {
        setOpenResend(false)
        setResendTarget(null)
    }

    function showSentBadge(rowId: string) {
        const ts = Date.now()
        setSentBadgeAt((p) => ({ ...p, [rowId]: ts }))

        window.setTimeout(() => {
            setSentBadgeAt((prev) => {
                const next = { ...prev }
                if ((next[rowId] ?? 0) <= ts) {
                    delete next[rowId]
                }
                return next
            })
        }, RESEND_SUCCESS_BADGE_MS)
    }

    async function resendCredentialsNow(it: UserDoc) {
        const key = it.$id

        if (!it.isActive) {
            toast.error("Cannot resend credentials for an inactive user.")
            return false
        }

        const remaining = getCooldownRemainingSeconds(key)
        if (remaining > 0) {
            toast.info(`Please wait ${remaining}s before resending again.`)
            return false
        }

        const safeUserId = String(it.userId || it.$id || "").trim()
        if (!safeUserId) {
            toast.error("Missing userId for this row. Please refresh or re-create user profile.")
            return false
        }

        setResending((p) => ({ ...p, [key]: true }))

        try {
            await adminApi.users.resendCredentials({
                docId: it.$id,
                userId: safeUserId,
                email: it.email,
                name: it.name || null,
            })

            setCooldowns((p) => ({ ...p, [key]: Date.now() + RESEND_COOLDOWN_MS }))
            showSentBadge(key)

            toast.success("Credentials resent. A new temporary password was emailed.")
            return true
        } catch (e: any) {
            toast.error(e?.message || "Failed to resend credentials.")
            return false
        } finally {
            setResending((p) => ({ ...p, [key]: false }))
        }
    }

    async function confirmResend() {
        if (!resendTarget) return
        const ok = await resendCredentialsNow(resendTarget)
        if (ok) closeResendConfirm()
    }

    const headerActions = (
        <>
            <Button variant="secondary" onClick={() => loadAll()} disabled={loading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                Refresh
            </Button>

            <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add user
            </Button>
        </>
    )

    return (
        <DashboardLayout
            title="User Management"
            subtitle="Add / edit / deactivate accounts and assign roles (Admin, Dept Head, Faculty)."
            actions={headerActions}
        >
            <div className="mx-auto w-full max-w-none p-4 sm:p-6 lg:p-8">
                {error ? (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Failed to load</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <Card className="w-full min-w-0">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-base">Users</CardTitle>
                        <CardDescription>Manage system accounts and role assignments.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:max-w-md">
                                <Label htmlFor="search" className="sr-only">
                                    Search
                                </Label>
                                <Input
                                    id="search"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search by name, email, role, department…"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="inactive"
                                    checked={includeInactive}
                                    onCheckedChange={(v: any) => setIncludeInactive(Boolean(v))}
                                />
                                <Label htmlFor="inactive" className="text-sm text-muted-foreground">
                                    Include inactive
                                </Label>
                            </div>
                        </div>

                        {/* ✅ Tiny Admin UI: First Login Summary */}
                        {!loading ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                                <Badge variant="secondary" className="gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    First Login Pending: {firstLoginStats.pending}
                                </Badge>

                                <Badge variant="secondary" className="gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Completed: {firstLoginStats.completed}
                                </Badge>
                            </div>
                        ) : null}

                        <Separator />

                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-5/6" />
                                <Skeleton className="h-8 w-2/3" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="rounded-lg border border-border/70 p-6 text-center">
                                <div className="text-sm font-medium">No users found</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Try adjusting your search or create a new user.
                                </div>
                                <div className="mt-4">
                                    <Button onClick={openCreate}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add user
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-full overflow-hidden rounded-lg border border-border/70">
                                <div className="max-w-full overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/40">
                                            <tr className="text-left">
                                                <th className="px-4 py-3 font-medium">User</th>
                                                <th className="px-4 py-3 font-medium">Role</th>
                                                <th className="px-4 py-3 font-medium">Department</th>
                                                <th className="px-4 py-3 font-medium">Status</th>
                                                <th className="px-4 py-3 font-medium">First Login</th>
                                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {filtered.map((it) => {
                                                const dept = it.departmentId ? deptMap.get(it.departmentId) : null
                                                const isResending = Boolean(resending[it.$id])

                                                const cooldownRemaining = getCooldownRemainingSeconds(it.$id)
                                                const cooldownActive = cooldownRemaining > 0

                                                const showSent = Boolean(sentBadgeAt[it.$id])
                                                const resendDisabled = isResending || !it.isActive || cooldownActive

                                                const safeDisplayId = it.userId || it.$id || "—"
                                                const safeUserId = String(it.userId || "").trim()

                                                // ✅ TRUE source: first_login_users table in Appwrite
                                                const st = safeUserId ? firstLoginMap[safeUserId] : undefined
                                                const isFirstLoginPending = st ? (!st.completed || st.mustChangePassword) : false

                                                return (
                                                    <tr
                                                        key={it.$id}
                                                        className="border-t border-border/60 hover:bg-muted/20"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background text-xs font-semibold">
                                                                    {initials(it.name || it.email)}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="truncate font-medium">{it.name || "—"}</div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        {it.email}
                                                                    </div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        ID: {safeDisplayId}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <Badge variant={roleBadgeVariant(it.role)}>
                                                                {roleLabel(it.role)}
                                                            </Badge>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            {dept ? (
                                                                <div className="min-w-0">
                                                                    <div className="truncate font-medium">{dept.name}</div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        {dept.code}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            {it.isActive ? (
                                                                <Badge variant="secondary" className="gap-1">
                                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                                    Active
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="destructive" className="gap-1">
                                                                    <UserMinus className="h-3.5 w-3.5" />
                                                                    Inactive
                                                                </Badge>
                                                            )}
                                                        </td>

                                                        {/* ✅ First Login Status */}
                                                        <td className="px-4 py-3">
                                                            {isFirstLoginPending ? (
                                                                <Badge variant="secondary" className="gap-1">
                                                                    <Clock className="h-3.5 w-3.5" />
                                                                    First Login Pending
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="gap-1">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    Completed
                                                                </Badge>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex flex-col items-end gap-2">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 whitespace-nowrap"
                                                                        onClick={() => openResendConfirm(it)}
                                                                        disabled={resendDisabled}
                                                                    >
                                                                        {isResending ? (
                                                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                                        ) : cooldownActive ? (
                                                                            <Clock className="mr-2 h-4 w-4" />
                                                                        ) : (
                                                                            <Mail className="mr-2 h-4 w-4" />
                                                                        )}

                                                                        {cooldownActive
                                                                            ? `Resend in ${cooldownRemaining}s`
                                                                            : "Resend Credentials"}
                                                                    </Button>

                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon">
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>

                                                                        <DropdownMenuContent align="end" className="min-w-44">
                                                                            <DropdownMenuItem onClick={() => openEdit(it)}>
                                                                                Edit
                                                                            </DropdownMenuItem>

                                                                            <DropdownMenuItem onClick={() => toggleActive(it)}>
                                                                                {it.isActive ? "Deactivate" : "Activate"}
                                                                            </DropdownMenuItem>

                                                                            <DropdownMenuSeparator />

                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onClick={() => openDeleteConfirm(it)}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>

                                                                {showSent ? (
                                                                    <Badge variant="secondary" className="gap-1">
                                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                                        Sent
                                                                    </Badge>
                                                                ) : null}

                                                                {!it.isActive ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Resend disabled for inactive users
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ✅ Resend Confirmation Dialog */}
            <Dialog open={openResend} onOpenChange={setOpenResend}>
                <DialogContent className="max-w-full sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Resend login credentials?</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            This will generate a <span className="font-medium">new temporary password</span> and email it
                            to the user again.
                        </p>

                        <div className="rounded-lg border border-border/70 p-3">
                            <div className="text-sm font-medium">{resendTarget?.name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{resendTarget?.email || ""}</div>
                            <div className="text-xs text-muted-foreground">
                                ID: {resendTarget?.userId || resendTarget?.$id || ""}
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                            ✅ The user will be forced to change their password on next login.
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={closeResendConfirm}>
                                Cancel
                            </Button>

                            <Button
                                onClick={confirmResend}
                                disabled={!resendTarget || Boolean(resendTarget && resending[resendTarget.$id])}
                            >
                                {resendTarget && resending[resendTarget.$id] ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <Mail className="mr-2 h-4 w-4" />
                                        Resend Email
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create/Edit Dialog */}
            <Dialog open={openForm} onOpenChange={setOpenForm}>
                <DialogContent className="max-w-full sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{form.$id ? "Edit user" : "Add user"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {form.$id ? (
                            <div className="grid gap-2">
                                <Label>User ID</Label>
                                <Input value={form.userId || ""} disabled />
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                                ✅ User account will be created and login credentials will be sent via email.
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                value={form.email}
                                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                placeholder="user@school.edu"
                                disabled={saving}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Full name"
                                disabled={saving}
                            />
                        </div>

                        {/* Role Picker */}
                        <div className="grid gap-2">
                            <Label>Role</Label>

                            <Popover open={rolePickerOpen} onOpenChange={setRolePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between" disabled={saving}>
                                        <span>{roleLabel(form.role)}</span>
                                        <UserPlus2 className="h-4 w-4 opacity-70" />
                                    </Button>
                                </PopoverTrigger>

                                <PopoverContent align="start" className="w-72 p-0">
                                    <Command>
                                        <CommandList>
                                            <CommandEmpty>No roles.</CommandEmpty>
                                            <CommandGroup heading="Select role">
                                                {ROLE_OPTIONS.map((r) => (
                                                    <CommandItem
                                                        key={r.value}
                                                        value={r.value}
                                                        onSelect={() => {
                                                            setForm((p) => ({
                                                                ...p,
                                                                role: r.value,
                                                                departmentId: canHaveDepartment(r.value)
                                                                    ? p.departmentId
                                                                    : "",
                                                            }))
                                                            setRolePickerOpen(false)
                                                        }}
                                                    >
                                                        {r.label}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Department Picker */}
                        {canHaveDepartment(form.role) ? (
                            <div className="grid gap-2">
                                <Label>Department</Label>

                                <Popover open={deptPickerOpen} onOpenChange={setDeptPickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between" disabled={saving}>
                                            <span className="truncate">
                                                {form.departmentId
                                                    ? deptMap.get(form.departmentId)?.name || "Select department"
                                                    : "Select department"}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {form.departmentId ? deptMap.get(form.departmentId)?.code || "" : ""}
                                            </span>
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent align="start" className="w-80 p-0">
                                        <Command>
                                            <CommandList>
                                                <CommandEmpty>No departments.</CommandEmpty>
                                                <CommandGroup heading="Departments">
                                                    {departments.map((d) => (
                                                        <CommandItem
                                                            key={d.$id}
                                                            value={`${d.code} ${d.name}`}
                                                            onSelect={() => {
                                                                setForm((p) => ({ ...p, departmentId: d.$id }))
                                                                setDeptPickerOpen(false)
                                                            }}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="truncate font-medium">{d.name}</div>
                                                                <div className="truncate text-xs text-muted-foreground">
                                                                    {d.code}
                                                                </div>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        ) : null}

                        {/* Active */}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="active"
                                checked={form.isActive}
                                onCheckedChange={(v: any) => setForm((p) => ({ ...p, isActive: Boolean(v) }))}
                                disabled={saving}
                            />
                            <Label htmlFor="active" className="text-sm text-muted-foreground">
                                Active account
                            </Label>
                        </div>

                        <Separator />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={saveForm} disabled={saving}>
                                {saving ? "Saving…" : "Save"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={openDelete} onOpenChange={setOpenDelete}>
                <DialogContent className="max-w-full sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete user?</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            This will permanently remove the user profile record
                            <span className="font-medium"> and the Appwrite Auth user</span>. You can also use
                            <span className="font-medium"> Deactivate </span>
                            instead.
                        </p>

                        {target ? (
                            <div className="rounded-lg border border-border/70 p-3">
                                <div className="text-sm font-medium">{target.name || "—"}</div>
                                <div className="text-xs text-muted-foreground">{target.email}</div>
                                <div className="text-xs text-muted-foreground">
                                    ID: {target.userId || target.$id || "—"}
                                </div>
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpenDelete(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={deleteNow}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
