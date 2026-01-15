/* eslint-disable @typescript-eslint/no-explicit-any */
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

    /**
     * ✅ HIDE GLOBAL SCROLLBAR (html/body)
     * ✅ NO padding-right added
     */
    React.useEffect(() => {
        if (typeof window === "undefined") return

        const html = document.documentElement
        const body = document.body

        const prevHtmlOverflow = html.style.overflow
        const prevBodyOverflow = body.style.overflow
        const prevBodyPaddingRight = body.style.paddingRight
        const prevBodyOverscroll = (body.style as any).overscrollBehavior

        html.style.overflow = "hidden"
        body.style.overflow = "hidden"
        body.style.paddingRight = "0px"
            ; (body.style as any).overscrollBehavior = "none"

        return () => {
            html.style.overflow = prevHtmlOverflow
            body.style.overflow = prevBodyOverflow
            body.style.paddingRight = prevBodyPaddingRight
                ; (body.style as any).overscrollBehavior = prevBodyOverscroll
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
            {/* ✅ More space LEFT, less space RIGHT + sidebar shorter */}
            <div className="flex min-h-dvh w-full min-w-0 overflow-hidden gap-3 pl-5 pr-2 py-2">
                {/* ✅ Sidebar card: shorter height + rounded */}
                <Sidebar
                    variant="inset"
                    collapsible="icon"
                    className="min-w-0 m-4 shrink-0 rounded-2xl border border-sidebar-border bg-sidebar shadow-sm overflow-hidden h-[calc(100dvh-2rem)]"
                >
                    <SidebarHeader className="border-none border-b min-w-0">
                        <SidebarHeaderBrand />
                    </SidebarHeader>

                    <SidebarContent className="min-w-0">
                        <NavMain />
                    </SidebarContent>

                    <SidebarFooter className="relative z-50 border-t pointer-events-auto min-w-0">
                        <div className="p-2 min-w-0">
                            <NavUser className="w-full" showDetailsOnMobile />
                        </div>
                    </SidebarFooter>

                    <SidebarRail />
                </Sidebar>

                {/* ✅ Main content card also shorter (matches sidebar height) */}
                <SidebarInset className="relative min-w-0 flex-1 rounded-2xl border border-border bg-background shadow-sm overflow-y-auto overflow-x-hidden h-[calc(100dvh-2rem)]">
                    <DashboardHeader title={title} subtitle={subtitle} actions={actions} />

                    <div className="min-w-0">{children}</div>
                </SidebarInset>
            </div>
        </SidebarProvider>
    )
}
