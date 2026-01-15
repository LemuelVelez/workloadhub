"use client"

import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"

export type SidebarHeaderBrandProps = {
    className?: string
}

export default function SidebarHeaderBrand({ className }: SidebarHeaderBrandProps) {
    const { state, isMobile } = useSidebar()

    // ✅ "icon" collapsed mode only applies on desktop
    const collapsed = state === "collapsed" && !isMobile

    return (
        <div
            className={cn(
                "relative flex min-w-0 items-center",
                collapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-3",
                className
            )}
        >
            <Link
                to="/dashboard"
                aria-label="WorkloadHub"
                className={cn(
                    "flex items-center min-w-0",
                    collapsed ? "w-full justify-center" : "gap-2"
                )}
            >
                {/* ✅ Fixed-size logo container so the SVG never looks tiny */}
                <div
                    className={cn(
                        "flex items-center justify-center shrink-0",
                        collapsed ? "h-10 w-10" : "h-10 w-10"
                    )}
                >
                    <img
                        src="/logo.svg"
                        alt="WorkloadHub"
                        draggable={false}
                        className="h-full w-full object-contain"
                    />
                </div>

                {/* ✅ Hide text when collapsed so logo stays centered + big */}
                {!collapsed ? (
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold">WorkloadHub</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                            Faculty workload platform
                        </div>
                    </div>
                ) : (
                    <span className="sr-only">WorkloadHub</span>
                )}
            </Link>
        </div>
    )
}
