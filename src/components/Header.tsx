import { Link } from "react-router-dom"
import { Menu } from "lucide-react"

import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "./ui/sheet"

import { useSession } from "@/hooks/use-session"

export default function Header() {
    const { isAuthenticated } = useSession()

    const actionHref = isAuthenticated ? "/dashboard" : "/auth/login"
    const actionLabel = isAuthenticated ? "Dashboard" : "Sign in"

    return (
        <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-white/15 bg-slate-950/35 text-white shadow-sm backdrop-blur-md">
            <div className="mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-2 text-white">
                        <img
                            src="/logo.svg"
                            alt="WorkloadHub"
                            className="h-8 w-8"
                            draggable={false}
                        />
                        <span className="text-base font-semibold">WorkloadHub</span>
                    </Link>

                    <Separator orientation="vertical" className="hidden h-6 bg-white/20 md:block" />
                </div>

                <div className="flex items-center gap-2">
                    <Button asChild variant="default" className="hidden md:inline-flex">
                        <Link to={actionHref}>{actionLabel}</Link>
                    </Button>

                    <div className="md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="default" size="icon" aria-label="Open menu">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>

                            <SheetContent side="right" className="w-80 border-white/15 bg-slate-950/95 text-white">
                                <SheetHeader>
                                    <SheetTitle className="flex items-center gap-2 text-white">
                                        <img
                                            src="/logo.svg"
                                            alt="WorkloadHub"
                                            className="h-7 w-7"
                                            draggable={false}
                                        />
                                        WorkloadHub
                                    </SheetTitle>
                                </SheetHeader>

                                <div className="mt-6 grid gap-3">
                                    <Separator className="my-2 bg-white/20" />

                                    <Button asChild variant="default">
                                        <Link to={actionHref}>{actionLabel}</Link>
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    )
}