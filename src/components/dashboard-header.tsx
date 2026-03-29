"use client"

import * as React from "react"
import { useLocation } from "react-router-dom"

import { NavUser } from "@/components/nav-user"

import { cn } from "@/lib/utils"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export type DashboardHeaderProps = {
    title?: string
    subtitle?: string
    actions?: React.ReactNode
    className?: string
}

function titleFromPath(pathname: string) {
    const p = (pathname ?? "").split("?")[0] ?? ""
    if (!p.startsWith("/dashboard")) return "Dashboard"

    const parts = p.split("/").filter(Boolean)
    const pretty = parts
        .slice(1)
        .map((s) => s.replace(/-/g, " "))
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))

    if (!pretty.length) return "Dashboard"
    return pretty.join(" • ")
}

export default function DashboardHeader({
    title,
    subtitle,
    actions,
    className,
}: DashboardHeaderProps) {
    const location = useLocation()

    const pathname = location.pathname ?? ""
    const derivedTitle = title ?? titleFromPath(pathname)

    return (
        <header
            className={cn(
                className,
                "sticky top-0 z-50 shrink-0 w-full min-w-0 overflow-x-hidden border-b bg-background/70 backdrop-blur"
            )}
        >
            <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <SidebarTrigger aria-label="Toggle sidebar" />
                        </TooltipTrigger>
                        <TooltipContent>Toggle sidebar</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base">
                            {derivedTitle}
                        </h1>
                    </div>
                    {subtitle ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                {actions ? (
                    <>
                        <Separator orientation="vertical" className="hidden h-6 shrink-0 lg:block" />
                        <div className="hidden min-w-0 flex-wrap items-center justify-end gap-2 lg:flex">
                            {actions}
                        </div>
                    </>
                ) : null}

                <div className="flex shrink-0 items-center gap-2">
                    <NavUser placement="header" />
                </div>
            </div>
        </header>
    )
}