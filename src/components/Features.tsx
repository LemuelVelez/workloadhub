import {
    BarChart3,
    Building2,
    ClipboardList,
    Layers3,
    Shield,
    Bell,
} from "lucide-react";

import Section from "./Section";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const featureCards = [
    {
        icon: Building2,
        title: "Master Data Management",
        badge: "Admin",
        items: ["Departments", "Programs/Courses", "Subjects", "Rooms & Facilities"],
    },
    {
        icon: Layers3,
        title: "Academic Term Setup",
        badge: "Admin",
        items: ["School year / semester", "Time blocks", "Rules & policies", "Lock terms when finalized"],
    },
    {
        icon: ClipboardList,
        title: "Scheduling & Workload",
        badge: "Dept Head",
        items: ["Class scheduling", "Faculty load assignment", "Room utilization", "Versioned schedules"],
    },
    {
        icon: Shield,
        title: "Conflict Checker",
        badge: "Dept Head",
        items: ["Faculty overlaps", "Room overlaps", "Section overlaps", "Fast review workflow"],
    },
    {
        icon: Bell,
        title: "Announcements & Notifications",
        badge: "All roles",
        items: ["Schedule updates", "Approvals/locking", "Change requests", "Targeted messaging"],
    },
    {
        icon: BarChart3,
        title: "Reports Module",
        badge: "Dept Head",
        items: ["Faculty load summary", "Department schedule", "Room utilization", "Conflict / changes report"],
    },
];

export default function Features() {
    return (
        <Section
            id="features"
            eyebrow="Core modules"
            title="Everything you need to run scheduling"
            description="From clean master data to approval-ready schedules, WorkloadHub keeps the workflow structured for every role."
            showSeparator
            className="py-16"
        >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {featureCards.map((f) => (
                    <Card key={f.title} className="h-full">
                        <CardHeader className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/40">
                                    <f.icon className="h-5 w-5" />
                                </div>
                                <Badge variant="secondary">{f.badge}</Badge>
                            </div>
                            <CardTitle className="text-base">{f.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                {f.items.map((it) => (
                                    <li key={it} className="flex items-start gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
                                        <span>{it}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </Section>
    );
}
