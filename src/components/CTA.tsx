import { Rocket } from "lucide-react"
import { Link } from "react-router-dom"

import Section from "./Section"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

import { useSession } from "@/hooks/use-session"

export default function CTA() {
    const { isAuthenticated } = useSession()

    const actionHref = isAuthenticated ? "/dashboard" : "/auth/login"
    const actionLabel = isAuthenticated ? "Dashboard" : "Sign in"

    return (
        <Section
            id="cta"
            eyebrow="Get started"
            title="Ready to pilot WorkloadHub?"
            description="Start with master data + term setup, then build schedules in versions, validate conflicts, and finalize with audit logs."
            className="py-16"
        >
            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Rocket className="h-4 w-4" />
                        Launch a department pilot
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        We’ll help you structure roles, workflows, and initial schedules.
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="secondary">
                            <Link to={actionHref}>{actionLabel}</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </Section>
    )
}
