
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"

import DashboardHeader from "@/components/dashboard-header"
import SidebarHeaderBrand from "@/components/sidebar-header"
import NavMain from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export type DashboardLayoutProps = {
    children: React.ReactNode
    title?: string
    subtitle?: string
    actions?: React.ReactNode
}

export default function DashboardLayout({
    children,
    title,
    subtitle,
    actions,
}: DashboardLayoutProps) {
    const navigate = useNavigate()
    const { user, loading } = useSession()

    // ✅ Remove the global/body scrollbar on dashboard routes (prevents double scrollbar)
    React.useEffect(() => {
        if (typeof window === "undefined") return

        const el = document.documentElement
        const body = document.body

        const prevPaddingRight = body.style.paddingRight
        const scrollbarWidth = window.innerWidth - el.clientWidth

        el.classList.add("dashboard-scroll-lock")
        body.classList.add("dashboard-scroll-lock")

        // prevent layout shift when body scrollbar disappears
        if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

        return () => {
            el.classList.remove("dashboard-scroll-lock")
            body.classList.remove("dashboard-scroll-lock")
            body.style.paddingRight = prevPaddingRight
        }
    }, [])

    // ✅ Protect dashboard routes
    React.useEffect(() => {
        if (loading) return
        if (!user) navigate("/auth/login", { replace: true })
    }, [loading, user, navigate])

    if (loading) {
        return (
            <div className="min-h-dvh w-full">
                <div className="p-6">
                    <Skeleton className="h-10 w-56" />
                    <div className="mt-6 space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-5/6" />
                        <Skeleton className="h-8 w-2/3" />
                    </div>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <SidebarProvider defaultOpen>
            <Sidebar variant="inset" collapsible="icon" className="min-w-0">
                <SidebarHeader className="border-none border-b min-w-0">
                    <SidebarHeaderBrand />
                </SidebarHeader>

                <SidebarContent className="min-w-0">
                    <NavMain />
                </SidebarContent>

                {/* ✅ Mobile: show name + role in sidebar footer */}
                <SidebarFooter className="relative z-50 border-t pointer-events-auto min-w-0">
                    <div className="p-2 min-w-0">
                        <NavUser className="w-full" showDetailsOnMobile />
                    </div>
                </SidebarFooter>

                <SidebarRail />
            </Sidebar>

            {/* ✅ ONLY scrollbar you will see: this one (dashboard inset) */}
            <SidebarInset className="relative h-dvh min-w-0 overflow-y-auto overflow-x-hidden">
                <DashboardHeader title={title} subtitle={subtitle} actions={actions} />

                <div className="min-w-0">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    )
}
