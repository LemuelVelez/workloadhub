import { Link } from "react-router-dom"

import Section from "./Section"
import { Button } from "./ui/button"

import { useSession } from "@/hooks/use-session"

export default function Hero() {
    const { isAuthenticated } = useSession()

    const actionHref = isAuthenticated ? "/dashboard" : "/auth/login"
    const actionLabel = isAuthenticated ? "Dashboard" : "Sign in"

    return (
        <div className="w-full pt-4 text-white">
            <Section id="top">
                <div className="grid gap-8 pb-7 lg:grid-cols-2 lg:items-center">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
                                Faculty workload + scheduling platform
                            </p>

                            <div className="space-y-4">
                                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                                    Plan schedules faster.{" "}
                                    <span className="text-white/85">
                                        Stay audit-ready.
                                    </span>
                                </h1>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button asChild variant="default">
                                <Link to={actionHref}>{actionLabel}</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-2 shadow-2xl backdrop-blur-sm">
                            <img
                                src="/Hero.jpg"
                                alt="WorkloadHub hero illustration"
                                className="h-auto w-full rounded-2xl"
                                draggable={false}
                            />
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    )
}