/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Loader2, Eye, EyeOff, KeyRound, Mail } from "lucide-react"
import { toast } from "sonner"

import { authApi } from "@/api/auth"
import { hasValidRecoveryParams, readRecoveryParamsFromLocation } from "@/lib/passwordrecovery"
import { updateMyPrefs } from "@/lib/auth"
import { verifyAuthUserOnServer } from "@/lib/authverification"

// ✅ NEW
import { markFirstLoginCompleted } from "@/lib/first-login"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function errorToText(err: any) {
    return err?.message || "Reset failed. Please try again."
}

export default function ResetPasswordPage() {
    const navigate = useNavigate()
    const location = useLocation()

    const params = React.useMemo(() => readRecoveryParamsFromLocation(location.search), [location.search])
    const valid = hasValidRecoveryParams(params)

    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [passwordConfirm, setPasswordConfirm] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)

    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem("workloadhub:lastEmail")
            if (saved && !email) setEmail(saved)
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (!valid || !params.userId || !params.secret) {
            setError("This reset link is missing required parameters. Please request a new reset email.")
            return
        }

        const cleanEmail = email.trim().toLowerCase()
        if (!cleanEmail) {
            setError("Email is required to verify your account after reset.")
            return
        }

        if (!password.trim() || password.trim().length < 8) {
            setError("Password must be at least 8 characters.")
            return
        }

        if (password !== passwordConfirm) {
            setError("Passwords do not match.")
            return
        }

        setLoading(true)

        try {
            await authApi.resetPassword({
                userId: params.userId,
                secret: params.secret,
                password,
                passwordConfirm,
            })

            await authApi.login(cleanEmail, password)

            await updateMyPrefs({
                mustChangePassword: false,
                isVerified: true,
                verifiedAt: new Date().toISOString(),
            })

            await verifyAuthUserOnServer(params.userId)

            // ✅ NEW: If this user was a first-time gated user, complete it
            await markFirstLoginCompleted(params.userId).catch(() => null)

            try {
                window.localStorage.setItem("workloadhub:lastEmail", cleanEmail)
            } catch {
                // ignore
            }

            toast.success("Password updated ✅ Your account is now verified.")
            navigate("/dashboard", { replace: true })
        } catch (err: any) {
            setError(errorToText(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
                <Card className="w-full">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">Reset password</CardTitle>
                        <CardDescription>Set a new password for your account.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {!valid ? (
                            <Alert variant="destructive">
                                <AlertTitle>Invalid reset link</AlertTitle>
                                <AlertDescription>
                                    This link is missing required parameters. Please request a new reset email.
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Couldn’t reset password</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Account email</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-9"
                                        disabled={loading || !valid}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">New password</Label>
                                <div className="relative">
                                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-9 pr-10"
                                        disabled={loading || !valid}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1 h-8 w-8"
                                        onClick={() => setShowPassword((v) => !v)}
                                        disabled={loading || !valid}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="passwordConfirm">Confirm new password</Label>
                                <Input
                                    id="passwordConfirm"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="Repeat new password"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    disabled={loading || !valid}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading || !valid}>
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
                                ✅ After updating your password, your account will be <b>verified automatically</b>.
                            </div>
                        </form>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between">
                        <Link to="/auth/login" className="text-sm underline-offset-4 hover:underline">
                            Back to sign in
                        </Link>
                        <Link
                            to="/auth/forgot-password"
                            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        >
                            Request new link
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
