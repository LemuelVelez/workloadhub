/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom"
import { ArrowLeft, Home, LayoutDashboard, Search } from "lucide-react"

import Header from "@/components/Header"
import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function NotFoundPage() {
    const { isAuthenticated } = useSession()

    const primaryHref = isAuthenticated ? "/dashboard" : "/"
    const primaryLabel = isAuthenticated ? "Go to dashboard" : "Back to home"
    const PrimaryIcon = isAuthenticated ? LayoutDashboard : Home

    return (
        <div className="min-h-screen w-full bg-background">
            <Header />

            <main className="mx-auto flex max-w-3xl items-center px-4 py-10">
                <Card className="w-full overflow-hidden">
                    <CardHeader className="space-y-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <img
                                src="/logo.svg"
                                alt="WorkloadHub"
                                className="h-7 w-7"
                                draggable={false}
                            />
                            <span>Page not found</span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="grid gap-2">
                            <div className="text-5xl font-bold tracking-tight">404</div>
                            <p className="text-sm text-muted-foreground">
                                The page you’re trying to access doesn’t exist or may have been moved.
                            </p>
                        </div>

                        <Separator />

                        <div className="grid gap-3 sm:grid-cols-2">
                            <Button asChild>
                                <Link to={primaryHref}>
                                    <PrimaryIcon className="mr-2 h-4 w-4" />
                                    {primaryLabel}
                                </Link>
                            </Button>

                            <Button asChild variant="secondary">
                                <Link to={-1 as any}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Go back
                                </Link>
                            </Button>
                        </div>

                        <div className="rounded-lg border border-border/70 p-4">
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 opacity-70" />
                                <div className="text-sm font-medium">Tip</div>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                If you typed the URL manually, double-check the spelling. If you clicked a link,
                                it may be outdated.
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <Button asChild variant="ghost">
                                <Link to="/">
                                    <Home className="mr-2 h-4 w-4" />
                                    Landing page
                                </Link>
                            </Button>

                            <span className="text-xs text-muted-foreground">
                                WorkloadHub • Routing fallback
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
