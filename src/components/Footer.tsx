import { Link } from "react-router-dom"

import Section from "./Section"
import { Separator } from "./ui/separator"

export default function Footer() {
    return (
        <footer className="border-t border-white/15 text-white">
            <Section className="py-10">
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <img
                                src="/logo.svg"
                                alt="WorkloadHub"
                                className="h-7 w-7"
                                draggable={false}
                            />
                            <div className="text-base font-semibold text-white">WorkloadHub</div>
                        </div>
                        <div className="text-sm text-white/75">
                            A structured scheduling + workload platform for universities.
                        </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                        <div className="font-medium text-white">Account</div>
                        <Link
                            to="/auth/login"
                            className="text-white/75 underline-offset-4 hover:text-white hover:underline"
                        >
                            Sign in
                        </Link>
                        <Link
                            to="/auth/forgot-password"
                            className="text-white/75 underline-offset-4 hover:text-white hover:underline"
                        >
                            Forgot password
                        </Link>
                    </div>
                </div>

                <Separator className="my-6 bg-white/20" />

                <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
                    <div>© {new Date().getFullYear()} WorkloadHub</div>
                </div>
            </Section>
        </footer>
    )
}