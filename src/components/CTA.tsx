import { Rocket } from "lucide-react";

import Section from "./Section";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function CTA() {
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
                            <a href="/auth/login">Sign in</a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </Section>
    );
}
