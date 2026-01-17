/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { completeFirstLoginPasswordChange } from "@/lib/authverification"
import { clearSessionCache } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const AUTH_PENDING_KEY = "workloadhub:auth:pendingAt"

export default function ChangePasswordPage() {
    const navigate = useNavigate()

    const [oldPassword, setOldPassword] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")

    const [showOld, setShowOld] = React.useState(false)
    const [showNew, setShowNew] = React.useState(false)

    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    // ✅ Prevent double submit / double redirect
    const redirectingRef = React.useRef(false)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (loading) return
        if (redirectingRef.current) return

        const oldP = oldPassword
        const newP = newPassword.trim()
        const conf = confirmPassword.trim()

        if (!oldP) {
            setError("Current password is required.")
            return
        }

        if (!newP || newP.length < 8) {
            setError("New password must be at least 8 characters.")
            return
        }

        if (newP !== conf) {
            setError("Passwords do not match.")
            return
        }

        if (newP === oldP) {
            setError("New password must be different from the current password.")
            return
        }

        setLoading(true)

        try {
            // ✅ This now:
            // 1) changes password
            // 2) verifies account (server)
            // 3) marks first-login completed
            // 4) clears ALL sessions in Appwrite
            await completeFirstLoginPasswordChange({
                oldPassword: oldP,
                newPassword: newP,
                confirmPassword: conf,
            })

            // ✅ stop any auth pending state
            try {
                window.localStorage.removeItem(AUTH_PENDING_KEY)
            } catch {
                // ignore
            }

            // ✅ Clear cached session snapshots (prevents redirect glitch)
            try {
                clearSessionCache?.()
            } catch {
                // ignore
            }

            toast.success("Password updated ✅ Please sign in again.")

            redirectingRef.current = true
            navigate("/auth/login", { replace: true, state: { forceReLogin: true } })
        } catch (err: any) {
            setError(err?.message || "Failed to update password.")
            redirectingRef.current = false
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
                <Card className="w-full">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">Change password</CardTitle>
                        <CardDescription>
                            For security, you must change your password before accessing your account.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Update failed</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="old">Current password</Label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="old"
                                        type={showOld ? "text" : "password"}
                                        value={oldPassword}
                                        onChange={(e: any) => setOldPassword(e.target.value)}
                                        className="pl-9 pr-10"
                                        disabled={loading}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1 h-8 w-8"
                                        onClick={() => setShowOld((v) => !v)}
                                        disabled={loading}
                                        aria-label={showOld ? "Hide current password" : "Show current password"}
                                    >
                                        {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new">New password</Label>
                                <div className="relative">
                                    <Input
                                        id="new"
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e: any) => setNewPassword(e.target.value)}
                                        disabled={loading}
                                        placeholder="At least 8 characters"
                                        className="pr-10"
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1 h-8 w-8"
                                        onClick={() => setShowNew((v) => !v)}
                                        disabled={loading}
                                        aria-label={showNew ? "Hide new password" : "Show new password"}
                                    >
                                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm">Confirm new password</Label>
                                <Input
                                    id="confirm"
                                    type={showNew ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e: any) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                    placeholder="Repeat new password"
                                    required
                                />
                            </div>

                            <Separator />

                            <Button className="w-full" type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating…
                                    </>
                                ) : (
                                    "Update password"
                                )}
                            </Button>

                            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                                ✅ After changing your password, your account will be verified and you will be logged out automatically.
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
