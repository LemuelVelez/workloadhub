import { CheckCircle2, GitMerge, Lock, Wand2 } from "lucide-react";

import Section from "./Section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export default function HowItWorks() {
    return (
        <Section
            id="how-it-works"
            eyebrow="Workflow"
            title="How WorkloadHub works"
            description="A predictable flow: setup → plan → assign → validate → finalize. Built for real departments."
            showSeparator
            className="py-16"
        >
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Step-by-step</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible defaultValue="step-1">
                            <AccordionItem value="step-1">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="h-4 w-4" />
                                        1) Set up master data + term
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground">
                                    Admin prepares departments, programs, subjects, rooms, time blocks, and system policies.
                                    Everything stays consistent for scheduling.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-2">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <GitMerge className="h-4 w-4" />
                                        2) Create schedule versions
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground">
                                    Department heads build schedules in Draft versions. Compare changes and iterate safely.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-3">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        3) Assign workload + validate conflicts
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground">
                                    Assign faculty, rooms, and sections. The system detects overlaps and helps resolve conflicts early.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-4">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Lock className="h-4 w-4" />
                                        4) Approve, lock, and notify
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground">
                                    Finalize schedules, lock terms or versions, and publish notifications so faculty stays updated.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>

                <div id="roles" className="space-y-4">
                    <Tabs defaultValue="admin">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="admin">Admin</TabsTrigger>
                            <TabsTrigger value="scheduler">Dept Head</TabsTrigger>
                            <TabsTrigger value="faculty">Faculty</TabsTrigger>
                        </TabsList>

                        <TabsContent value="admin" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">System Administrator — Pages</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li>• Admin Dashboard – overview of users, departments, active semester, system status</li>
                                        <li>• User Management – add/edit/deactivate accounts; assign roles</li>
                                        <li>• Master Data – departments, programs/courses, subjects, faculty profiles</li>
                                        <li>• Rooms & Facilities – rooms, capacity, types</li>
                                        <li>• Academic Term Setup – school year/semester, time blocks</li>
                                        <li>• System Rules/Policies – scheduling rules and limits</li>
                                        <li>• Audit Logs – track changes and actions</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="scheduler" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Department Head / Scheduler — Pages</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li>• Scheduler Dashboard – dept status, conflicts, workload distribution</li>
                                        <li>• Faculty Workload Assignment – assign loads; totals per faculty</li>
                                        <li>• Class Scheduling – day/time/room/section/faculty</li>
                                        <li>• Conflict Checker – overlaps for faculty/room/section</li>
                                        <li>• Faculty Availability – use preferences during scheduling</li>
                                        <li>• Room Utilization – room schedule grid</li>
                                        <li>• Approval/Finalization – approve and lock schedules; manage versions</li>
                                        <li>• Reports – load summary, schedule report, room utilization, conflicts</li>
                                        <li>• Announcements/Notifications – updates to faculty</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="faculty" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Faculty Member — Pages</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li>• Faculty Dashboard – classes, weekly schedule, totals</li>
                                        <li>• My Schedule – view/print weekly or term view</li>
                                        <li>• My Workload Summary – units/hours totals</li>
                                        <li>• Availability Submission – preferred/unavailable time slots</li>
                                        <li>• Notifications – updates and approvals</li>
                                        <li>• Profile – update basic information</li>
                                        <li>• Request Change – submit load/schedule change requests</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </Section>
    );
}
