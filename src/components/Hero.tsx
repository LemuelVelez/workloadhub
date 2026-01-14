import { ArrowRight, CalendarCheck2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";

import Section from "./Section";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";

export default function Hero() {
    return (
        <div className="w-full">
            <Section
                id="top"
                eyebrow="Faculty workload + scheduling platform"
                title={
                    <>
                        Plan schedules faster. <span className="text-muted-foreground">Stay audit-ready.</span>
                    </>
                }
                description={
                    <>
                        WorkloadHub helps admins, department heads, and faculty coordinate class schedules,
                        workloads, availability, approvals, and change requests—without spreadsheets chaos.
                    </>
                }
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button asChild>
                            <a href="#cta">
                                Get started <ArrowRight className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                        <Button asChild variant="secondary">
                            <Link to="/auth/login">Sign in</Link>
                        </Button>
                        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                            <Badge variant="secondary">Role-based</Badge>
                            <Badge variant="secondary">Versioned schedules</Badge>
                            <Badge variant="secondary">Audit logs</Badge>
                        </div>
                    </div>
                }
            >
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">What you get</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-border/70 p-3">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <div className="text-sm font-medium">Role dashboards</div>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Admin • Scheduler • Faculty
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border/70 p-3">
                                        <div className="flex items-center gap-2">
                                            <CalendarCheck2 className="h-4 w-4" />
                                            <div className="text-sm font-medium">Conflict-aware</div>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Room • Faculty • Section checks
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border/70 p-3">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            <div className="text-sm font-medium">Audit-ready</div>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Change history + logs
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex items-start gap-2">
                                    <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                        Designed for universities with clear master data, term setup, versioning, approvals,
                                        and notifications—so schedules don’t break at the last minute.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="relative">
                        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4">
                            <img
                                src="/Hero.svg"
                                alt="WorkloadHub hero illustration"
                                className="h-auto w-full"
                                draggable={false}
                            />
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
}
