/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Account } from "appwrite"
import { Eye, EyeOff, KeyRound } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"
import { appwriteClient } from "@/lib/db"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SettingsPage() {
    const { user } = useSession()
    const account = React.useMemo(() => new Account(appwriteClient), [])

    const [currentPassword, setCurrentPassword] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")

    const [showCurrent, setShowCurrent] = React.useState(false)
    const [showNew, setShowNew] = React.useState(false)
    const [showConfirm, setShowConfirm] = React.useState(false)

    const [saving, setSaving] = React.useState(false)

    // ✅ IMPORTANT:
    // App.tsx uses this key to avoid redirect-to-login while auth/session is refreshing
    const AUTH_PENDING_KEY = "workloadhub:auth:pendingAt"

    const markAuthPending = React.useCallback(() => {
        try {
            if (typeof window === "undefined") return
            window.localStorage.setItem(AUTH_PENDING_KEY, String(Date.now()))
        } catch {
            // ignore
        }
    }, [])

    const onChangePassword = async () => {
        if (!user) {
            toast.error("No active session found.")
            return
        }

        if (!currentPassword.trim()) {
            toast.error("Current password is required.")
            return
        }

        if (newPassword.trim().length < 8) {
            toast.error("New password must be at least 8 characters.")
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation do not match.")
            return
        }

        if (newPassword === currentPassword) {
            toast.error("New password must be different from the current password.")
            return
        }

        const newPassSnapshot = newPassword

        try {
            setSaving(true)

            // ✅ protect session from instant redirect during auth refresh
            markAuthPending()

            await (account as any).updatePassword(newPassSnapshot, currentPassword)

            // ✅ verify session still valid (optional safety)
            try {
                await account.get()
            } catch {
                // If session was invalidated by backend for some reason,
                // we don't force logout here; RequireAuth will handle it gracefully.
            }

            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")

            toast.success("Password changed successfully!")
        } catch (err: any) {
            toast.error("Failed to change password", {
                description: err?.message || "Please check your current password and try again.",
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <DashboardLayout title="Settings" subtitle="Change your password.">
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
                            <BreadcrumbPage>Settings</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="size-4" />
                            Change Password
                        </CardTitle>
                        <CardDescription>
                            Update your password securely. This page is available to all users.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertTitle>Password Rules</AlertTitle>
                            <AlertDescription>
                                Use at least 8 characters and avoid using the same password as before.
                            </AlertDescription>
                        </Alert>

                        <Separator />

                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="currentPassword"
                                    type={showCurrent ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCurrent((v) => !v)}
                                >
                                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="newPassword"
                                    type={showNew ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowNew((v) => !v)}
                                >
                                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirm ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowConfirm((v) => !v)}
                                >
                                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="justify-end gap-2">
                        <Button onClick={onChangePassword} disabled={saving}>
                            {saving ? "Saving..." : "Update Password"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </DashboardLayout>
    )
}
