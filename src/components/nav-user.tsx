/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useNavigate } from "react-router-dom"
import {
    IconDotsVertical,
    IconLogout,
    IconUserCircle,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { authApi } from "@/api/auth"
import { clearSessionCache, useSession } from "@/hooks/use-session"

import { cn } from "@/lib/utils"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

type NavUserProps = {
    className?: string
    showDetailsOnMobile?: boolean
}

function initialsFromName(name: string) {
    const parts = (name || "User").trim().split(" ").filter(Boolean)
    const first = parts[0]?.[0] ?? "U"
    const second = parts[1]?.[0] ?? ""
    return (first + second).toUpperCase()
}

export function NavUser({ className, showDetailsOnMobile }: NavUserProps) {
    const navigate = useNavigate()
    const { isMobile, state } = useSidebar()
    const { user } = useSession()

    const displayName = user?.name || user?.email || "User"
    const email = user?.email || "—"

    // Simple avatar (DiceBear) fallback if you don't store avatar URLs
    const avatar =
        (user as any)?.avatar ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`

    const showDetails =
        showDetailsOnMobile === true ? true : !(state === "collapsed" && !isMobile)

    async function onLogout() {
        try {
            await authApi.logout()
            clearSessionCache()
            toast.success("Logged out successfully.")
            navigate("/auth/login", { replace: true })
        } catch (e: any) {
            toast.error(e?.message || "Logout failed.")
        }
    }

    return (
        <SidebarMenu className={cn(className)}>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={avatar} alt={displayName} />
                                <AvatarFallback className="rounded-lg">
                                    {initialsFromName(displayName)}
                                </AvatarFallback>
                            </Avatar>

                            {showDetails ? (
                                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                                    <span className="truncate font-medium">{displayName}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {email}
                                    </span>
                                </div>
                            ) : (
                                <span className="sr-only">Open user menu</span>
                            )}

                            <IconDotsVertical className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage src={avatar} alt={displayName} />
                                    <AvatarFallback className="rounded-lg">
                                        {initialsFromName(displayName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                                    <span className="truncate font-medium">{displayName}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {email}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                onClick={() => {
                                    toast.message("Account page is not available yet.")
                                }}
                            >
                                <IconUserCircle className="mr-2 size-4" />
                                Account
                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={onLogout}>
                            <IconLogout className="mr-2 size-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
