/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Account } from "appwrite"
import { Eye, EyeOff, Save, Upload, Trash2 } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"

import { appwriteClient, databases, DATABASE_ID, Query } from "@/lib/db"
import { storage, BUCKET_ID, ID as AppwriteID } from "@/lib/bucket"

import { ATTR, COLLECTIONS as SCHEMA_COLLECTIONS } from "@/model/schemaModel"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

function initialsFromName(name?: string | null) {
    const n = (name || "User").trim()
    const parts = n.split(/\s+/g).filter(Boolean)
    const a = parts[0]?.[0] ?? "U"
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return `${a}${b}`.toUpperCase()
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

function isValidEmail(value: string) {
    const v = value.trim()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function getAvatarFromUser(user: any) {
    const prefs = safeParsePrefs(user?.prefs)
    return String(user?.avatarUrl || prefs?.avatarUrl || "").trim()
}

function resolveUserId(user: any) {
    return String(user?.$id || user?.id || user?.userId || "").trim()
}

function resolveUserEmail(user: any) {
    const prefs = safeParsePrefs(user?.prefs)
    return String(
        user?.email ||
        user?.mail ||
        prefs?.email ||
        prefs?.profileEmail ||
        user?.profile?.email ||
        ""
    ).trim()
}

function resolveUserName(user: any) {
    const prefs = safeParsePrefs(user?.prefs)
    return String(
        user?.name ||
        user?.username ||
        prefs?.name ||
        prefs?.displayName ||
        user?.profile?.name ||
        "User"
    ).trim()
}

export default function AccountsPage() {
    const { user, loading, refresh } = useSession()

    const account = React.useMemo(() => new Account(appwriteClient), [])
    const userId = React.useMemo(() => resolveUserId(user), [user])

    const [profileDocId, setProfileDocId] = React.useState<string | null>(null)
    const [profileRole, setProfileRole] = React.useState<string>("")
    const [profileDepartmentId, setProfileDepartmentId] = React.useState<string>("")
    const [departmentName, setDepartmentName] = React.useState<string>("")

    const [displayName, setDisplayName] = React.useState("")
    const [email, setEmail] = React.useState("")

    // ✅ Track the AUTH email (real email from Appwrite account.get())
    const authEmailRef = React.useRef<string>("")

    // ✅ Avatar Upload States
    const fileRef = React.useRef<HTMLInputElement | null>(null)
    const [avatarUrl, setAvatarUrl] = React.useState<string>("")
    const [avatarUploading, setAvatarUploading] = React.useState(false)

    const [saving, setSaving] = React.useState(false)
    const [profileLoading, setProfileLoading] = React.useState(false)

    // ✅ Used by App.tsx to avoid redirect-to-login while session is refreshing
    const AUTH_PENDING_KEY = "workloadhub:auth:pendingAt"

    const markAuthPending = React.useCallback(() => {
        try {
            if (typeof window === "undefined") return
            window.localStorage.setItem(AUTH_PENDING_KEY, String(Date.now()))
        } catch {
            // ignore
        }
    }, [])

    const safeRefreshSession = React.useCallback(async () => {
        markAuthPending()
        try {
            await refresh()
        } catch {
            // ignore refresh errors
        }
    }, [markAuthPending, refresh])

    React.useEffect(() => {
        const n = resolveUserName(user)
        const e = resolveUserEmail(user)

        setDisplayName(n)
        setEmail(e)
        setAvatarUrl(getAvatarFromUser(user))

        // ✅ Store real auth email reference (used to detect if user changed email)
        authEmailRef.current = e
    }, [user])

    // ✅ Load USER_PROFILES row for the current user
    React.useEffect(() => {
        let alive = true

        const run = async () => {
            if (!userId) return

            setProfileLoading(true)

            try {
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    SCHEMA_COLLECTIONS.USER_PROFILES,
                    [Query.equal(ATTR.USER_PROFILES.userId, userId), Query.limit(1)]
                )

                const row = (res as any)?.documents?.[0]
                if (!alive) return

                if (row) {
                    setProfileDocId(row.$id)
                    setProfileRole(String(row.role || ""))
                    setProfileDepartmentId(String(row.departmentId || ""))

                    // ✅ NEW: prefer DB avatarUrl if exists
                    const dbAvatar = String(row?.avatarUrl || "").trim()
                    if (dbAvatar) {
                        setAvatarUrl(dbAvatar)
                    }
                } else {
                    setProfileDocId(null)
                    setProfileRole("")
                    setProfileDepartmentId("")
                }
            } catch {
                if (!alive) return
                setProfileDocId(null)
                setProfileRole("")
                setProfileDepartmentId("")
            } finally {
                if (alive) setProfileLoading(false)
            }
        }

        void run()

        return () => {
            alive = false
        }
    }, [userId])

    // ✅ Load Department name (if exists)
    React.useEffect(() => {
        let alive = true

        const run = async () => {
            if (!profileDepartmentId) {
                setDepartmentName("")
                return
            }

            try {
                const dep = await databases.getDocument(
                    DATABASE_ID,
                    SCHEMA_COLLECTIONS.DEPARTMENTS,
                    profileDepartmentId
                )

                if (!alive) return
                setDepartmentName(String((dep as any)?.name || ""))
            } catch {
                if (!alive) return
                setDepartmentName("")
            }
        }

        void run()

        return () => {
            alive = false
        }
    }, [profileDepartmentId])

    const openAvatarPicker = () => {
        if (avatarUploading) return
        fileRef.current?.click()
    }

    const updatePrefsPartial = async (next: Record<string, any>) => {
        const currentPrefs = safeParsePrefs(user?.prefs)
        const nextPrefs = { ...currentPrefs, ...next }

        await account.updatePrefs(nextPrefs)
        await safeRefreshSession()
    }

    const updateDbAvatarUrl = async (nextUrl: string) => {
        if (!profileDocId) return
        await databases.updateDocument(
            DATABASE_ID,
            SCHEMA_COLLECTIONS.USER_PROFILES,
            profileDocId,
            {
                [ATTR.USER_PROFILES.avatarUrl]: nextUrl,
            } as any
        )
    }

    const uploadAvatarToBucket = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.")
            return
        }

        const max = 5 * 1024 * 1024
        if (file.size > max) {
            toast.error("Image is too large. Max 5MB.")
            return
        }

        try {
            setAvatarUploading(true)

            const created = await storage.createFile(BUCKET_ID, AppwriteID.unique(), file)

            const preview = storage.getFilePreview(BUCKET_ID, created.$id)
            const previewUrl = String(preview)

            // ✅ store in prefs
            await updatePrefsPartial({
                avatarUrl: previewUrl,
                avatarFileId: created.$id,
            })

            // ✅ NEW: store in DB column user_profiles.avatarUrl
            await updateDbAvatarUrl(previewUrl)

            setAvatarUrl(previewUrl)
            toast.success("Avatar updated successfully!")
        } catch (err: any) {
            toast.error("Failed to upload avatar", {
                description: err?.message || "Please check bucket permissions and try again.",
            })
        } finally {
            setAvatarUploading(false)
        }
    }

    const onAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return
        await uploadAvatarToBucket(file)
    }

    const removeAvatar = async () => {
        try {
            setAvatarUploading(true)

            // ✅ clear prefs
            await updatePrefsPartial({
                avatarUrl: "",
                avatarFileId: "",
            })

            // ✅ NEW: clear DB avatar url
            await updateDbAvatarUrl("")

            setAvatarUrl("")
            toast.success("Avatar removed.")
        } catch (err: any) {
            toast.error("Failed to remove avatar", {
                description: err?.message || "Please try again.",
            })
        } finally {
            setAvatarUploading(false)
        }
    }

    // ✅ Email change dialog states (Appwrite requires password)
    const [confirmEmailOpen, setConfirmEmailOpen] = React.useState(false)
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)
    const [pendingUpdate, setPendingUpdate] = React.useState<{ name: string; email: string } | null>(
        null
    )

    const updateAuthEmail = async (nextEmail: string, password: string) => {
        const fn = (account as any)["updateEmail"]?.bind(account)
        if (!fn) {
            throw new Error("Appwrite SDK does not support updateEmail(). Please update your Appwrite SDK.")
        }

        // ✅ Support both signatures
        try {
            return await fn(nextEmail, password)
        } catch {
            return await fn({ email: nextEmail, password })
        }
    }

    const applySave = async (nextName: string, nextEmail: string, passwordForEmail?: string) => {
        const authEmail = String(authEmailRef.current || "").trim()
        const emailChanged = authEmail && nextEmail.toLowerCase() !== authEmail.toLowerCase()

        if (emailChanged) {
            if (!passwordForEmail?.trim()) {
                throw new Error("Current password is required to change email.")
            }
            await updateAuthEmail(nextEmail, passwordForEmail.trim())
        }

        try {
            await (account as any).updateName(nextName)
        } catch {
            // ignore
        }

        if (profileDocId) {
            await databases.updateDocument(
                DATABASE_ID,
                SCHEMA_COLLECTIONS.USER_PROFILES,
                profileDocId,
                {
                    [ATTR.USER_PROFILES.name]: nextName,
                    [ATTR.USER_PROFILES.email]: nextEmail,
                } as any
            )
        }

        await updatePrefsPartial({
            name: nextName,
            email: nextEmail,
        })

        await safeRefreshSession()
        authEmailRef.current = nextEmail
    }

    const onSaveProfile = async () => {
        const nextName = displayName.trim()
        const nextEmail = email.trim().toLowerCase()

        if (!nextName) {
            toast.error("Display name is required.")
            return
        }

        if (!nextEmail) {
            toast.error("Email is required.")
            return
        }

        if (!isValidEmail(nextEmail)) {
            toast.error("Please enter a valid email address.")
            return
        }

        if (!userId) {
            toast.error("No user session found.")
            return
        }

        const authEmail = String(authEmailRef.current || "").trim()
        const emailChanged = authEmail && nextEmail.toLowerCase() !== authEmail.toLowerCase()

        if (emailChanged) {
            setPendingUpdate({ name: nextName, email: nextEmail })
            setConfirmPassword("")
            setShowPassword(false)
            setConfirmEmailOpen(true)
            return
        }

        try {
            setSaving(true)
            await applySave(nextName, nextEmail)
            toast.success("Account updated successfully!")
        } catch (err: any) {
            toast.error("Failed to update account", {
                description: err?.message || "Please try again.",
            })
        } finally {
            setSaving(false)
        }
    }

    const confirmEmailChange = async () => {
        if (!pendingUpdate) return

        if (!confirmPassword.trim()) {
            toast.error("Current password is required to update your email.")
            return
        }

        try {
            setSaving(true)
            await applySave(pendingUpdate.name, pendingUpdate.email, confirmPassword)
            setConfirmEmailOpen(false)
            setPendingUpdate(null)
            setConfirmPassword("")
            toast.success("Account updated successfully!")
        } catch (err: any) {
            toast.error("Failed to update email", {
                description: err?.message || "Incorrect password or email already taken.",
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <DashboardLayout title="Account" subtitle="Manage your personal information.">
            <div className="p-5 space-y-5">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/dashboard">Dashboard</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Account</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                {(loading || profileLoading) ? (
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                                <Avatar className="size-12">
                                    <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
                                    <AvatarFallback>{initialsFromName(displayName)}</AvatarFallback>
                                </Avatar>

                                <div className="min-w-0">
                                    <CardTitle className="truncate">{displayName}</CardTitle>
                                    <CardDescription className="truncate">
                                        {email || "No email detected"}
                                    </CardDescription>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {profileRole ? (
                                            <Badge variant="secondary">{String(profileRole)}</Badge>
                                        ) : (
                                            <Badge variant="outline">ROLE: Unknown</Badge>
                                        )}

                                        {departmentName ? (
                                            <Badge variant="outline">{departmentName}</Badge>
                                        ) : (
                                            <Badge variant="outline">Department: N/A</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium">Profile Avatar</div>
                                        <div className="text-sm text-muted-foreground truncate">
                                            Upload a new image to Appwrite Bucket
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={onAvatarFileChange}
                                            className="hidden"
                                        />

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={openAvatarPicker}
                                            disabled={avatarUploading}
                                        >
                                            <Upload className="mr-2 size-4" />
                                            Upload
                                        </Button>

                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={removeAvatar}
                                            disabled={avatarUploading || !avatarUrl}
                                        >
                                            <Trash2 className="mr-2 size-4" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="displayName">Display Name</Label>
                                        <Input
                                            id="displayName"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="Enter your name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Changing email requires your current password.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <Input value={profileRole ? String(profileRole) : "Unknown"} disabled />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Department</Label>
                                        <Input value={departmentName || "N/A"} disabled />
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="justify-end gap-2">
                            <Button onClick={onSaveProfile} disabled={saving}>
                                <Save className="mr-2 size-4" />
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {/* ✅ Email Change Confirmation Dialog */}
                <Dialog open={confirmEmailOpen} onOpenChange={setConfirmEmailOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Confirm Email Change</DialogTitle>
                            <DialogDescription>
                                To change your email, please enter your current password.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <div className="relative">
                                <Input
                                    id="currentPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Enter your current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setConfirmEmailOpen(false)
                                    setPendingUpdate(null)
                                    setConfirmPassword("")
                                }}
                                disabled={saving}
                            >
                                Cancel
                            </Button>

                            <Button type="button" onClick={confirmEmailChange} disabled={saving}>
                                {saving ? "Saving..." : "Confirm & Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
