/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { Loader2, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { toast } from "sonner"

import { authApi } from "@/api/auth"
import { useSession } from "@/hooks/use-session"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function errorToText(err: any) {
    return err?.message || "Login failed. Please try again."
}

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()

    const { loading: sessionLoading, isAuthenticated } = useSession()

    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)
    const [remember, setRemember] = React.useState(true)

    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    // ✅ If already logged in, go directly to dashboard
    React.useEffect(() => {
        if (sessionLoading) return
        if (isAuthenticated) {
            navigate("/dashboard", { replace: true })
        }
    }, [sessionLoading, isAuthenticated, navigate])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            await authApi.login(email, password)

            // “remember” is primarily UX here—Appwrite session persistence is handled by Appwrite.
            if (!remember) {
                // If you want strict “session-only”, you can implement your own behavior here.
            }

            toast.success("Welcome back!")

            // ✅ Redirect user back to where they came from (if protected route redirected them)
            const from =
                (location.state as any)?.from && typeof (location.state as any).from === "string"
                    ? (location.state as any).from
                    : "/dashboard"

            navigate(from, { replace: true })
        } catch (err: any) {
            setError(errorToText(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            <div className="mx-auto flex min-h-screen max-w-md items-center py-10">
                <Card className="w-full">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">Sign in</CardTitle>
                        <CardDescription>Use your WorkloadHub account to continue.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Sign in failed</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e: { target: { value: React.SetStateAction<string> } }) =>
                                            setEmail(e.target.value)
                                        }
                                        className="pl-9"
                                        disabled={loading || sessionLoading}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        to="/auth/forgot-password"
                                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>

                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e: { target: { value: React.SetStateAction<string> } }) =>
                                            setPassword(e.target.value)
                                        }
                                        className="pl-9 pr-10"
                                        disabled={loading || sessionLoading}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1 h-8 w-8"
                                        onClick={() => setShowPassword((v) => !v)}
                                        disabled={loading || sessionLoading}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="remember"
                                        checked={remember}
                                        onCheckedChange={(v: any) => setRemember(Boolean(v))}
                                        disabled={loading || sessionLoading}
                                    />
                                    <Label htmlFor="remember" className="text-sm text-muted-foreground">
                                        Remember me
                                    </Label>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={loading || sessionLoading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in…
                                    </>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>
                        </form>

                        <Separator />

                        <p className="text-sm text-muted-foreground">
                            By signing in, you agree to your organization’s acceptable use policy.
                        </p>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Need help? Contact your admin.</span>
                        <Link to="/" className="text-sm underline-offset-4 hover:underline">
                            Back to home
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
