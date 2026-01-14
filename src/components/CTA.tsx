import * as React from "react";
import { toast } from "sonner";
import { Mail, Rocket } from "lucide-react";

import Section from "./Section";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export default function CTA() {
    const [email, setEmail] = React.useState("");
    const [org, setOrg] = React.useState("");
    const [notes, setNotes] = React.useState("");

    function submit(e: React.FormEvent) {
        e.preventDefault();
        toast.success("Request received! (wire backend later)");
        setEmail("");
        setOrg("");
        setNotes("");
    }

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

                        <Dialog>
                            <DialogTrigger asChild>
                                <Button>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Request demo
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Request a demo</DialogTitle>
                                    <DialogDescription>
                                        Share your contact and a quick note. Hook this to email/appwrite later.
                                    </DialogDescription>
                                </DialogHeader>

                                <form onSubmit={submit} className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="org">Organization</Label>
                                        <Input
                                            id="org"
                                            placeholder="JRMSU – Tampilisan"
                                            value={org}
                                            onChange={(e) => setOrg(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="notes">Notes</Label>
                                        <Textarea
                                            id="notes"
                                            placeholder="What departments/terms are you scheduling?"
                                            value={notes}
                                            onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setNotes(e.target.value)}
                                            rows={4}
                                        />
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button type="submit">Send request</Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>
        </Section>
    );
}
