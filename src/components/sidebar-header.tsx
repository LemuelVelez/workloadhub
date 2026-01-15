
"use client"

import { Link } from "react-router-dom"
import { LayoutDashboard } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export type SidebarHeaderBrandProps = {
    className?: string
}

export default function SidebarHeaderBrand({ className }: SidebarHeaderBrandProps) {
    return (
        <div className={cn("flex min-w-0 items-center justify-between gap-2 px-3 py-3", className)}>
            <div className="flex min-w-0 items-center gap-2">
                <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
                    <img
                        src="/logo.svg"
                        alt="WorkloadHub"
                        className="h-8 w-8"
                        draggable={false}
                    />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate text-sm font-semibold">
                                WorkloadHub
                            </span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                                Beta
                            </Badge>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                            Faculty workload platform
                        </div>
                    </div>
                </Link>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                    <Link to="/dashboard" aria-label="Dashboard home">
                        <LayoutDashboard className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            <Separator className="absolute left-0 right-0 bottom-0" />
        </div>
    )
}
