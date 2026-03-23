import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

import Section from "./Section"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"

import { useSession } from "@/hooks/use-session"

export default function Hero() {
    const { isAuthenticated } = useSession()

    const actionHref = isAuthenticated ? "/dashboard" : "/auth/login"
    const actionLabel = isAuthenticated ? "Dashboard" : "Sign in"

    return (
        <div className="w-full pt-4">
            <Section id="top">
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Faculty workload + scheduling platform
                            </p>

                            <div className="space-y-4">
                                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                                    Plan schedules faster.{" "}
                                    <span className="text-muted-foreground">
                                        Stay audit-ready.
                                    </span>
                                </h1>

                                <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                                    WorkloadHub helps admins, department heads, and faculty
                                    coordinate class schedules, workloads, availability,
                                    approvals, and change requests—without spreadsheets chaos.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button asChild>
                                <a href="#cta">
                                    Get started <ArrowRight className="ml-2 h-4 w-4" />
                                </a>
                            </Button>

                            <Button asChild variant="secondary">
                                <Link to={actionHref}>{actionLabel}</Link>
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">Role-based</Badge>
                            <Badge variant="secondary">Versioned schedules</Badge>
                            <Badge variant="secondary">Audit logs</Badge>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4">
                            <img
                                src="/Hero.jpg"
                                alt="WorkloadHub hero illustration"
                                className="h-auto w-full"
                                draggable={false}
                            />
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    )
}
