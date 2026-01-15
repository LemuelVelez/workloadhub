import { Link } from "react-router-dom";

import Section from "./Section";
import { Separator } from "./ui/separator";

export default function Footer() {
    return (
        <footer className="border-t border-border/60">
            <Section className="py-10">
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <img src="/logo.svg" alt="WorkloadHub" className="h-7 w-7" draggable={false} />
                            <div className="text-base font-semibold">WorkloadHub</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            A structured scheduling + workload platform for universities.
                        </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                        <div className="font-medium">Links</div>
                        <a href="#features" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                            Features
                        </a>
                        <a href="#how-it-works" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                            How it works
                        </a>
                        <a href="#roles" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                            Roles
                        </a>
                    </div>

                    <div className="grid gap-2 text-sm">
                        <div className="font-medium">Account</div>
                        <Link to="/auth/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                            Sign in
                        </Link>
                        <Link
                            to="/auth/forgot-password"
                            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                            Forgot password
                        </Link>
                    </div>
                </div>

                <Separator className="my-6" />

                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div>© {new Date().getFullYear()} WorkloadHub</div>
                </div>
            </Section>
        </footer>
    );
}
