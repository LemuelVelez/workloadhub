/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { IconDotsVertical, IconLogout, IconUserCircle } from "@tabler/icons-react"
import { toast } from "sonner"

import { authApi } from "@/api/auth"
import { clearSessionCache, useSession } from "@/hooks/use-session"

import { cn } from "@/lib/utils"

// ✅ NEW: fetch avatar from bucket via prefs
import { storage, BUCKET_ID } from "@/lib/bucket"

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

// ✅ NEW: shadcn alert dialog
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type NavUserPlacement = "sidebar" | "header"

type NavUserProps = {
    className?: string
    showDetailsOnMobile?: boolean
    placement?: NavUserPlacement
}

function initialsFromName(name: string) {
    const parts = (name || "User").trim().split(" ").filter(Boolean)
    const first = parts[0]?.[0] ?? "U"
    const second = parts[1]?.[0] ?? ""
    return (first + second).toUpperCase()
}

function safeParsePrefs(prefs: any) {
    if (!prefs) return {}
    if (typeof prefs === "string") {
        try {
            const parsed = JSON.parse(prefs)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
            return {}
        }
    }
    if (typeof prefs === "object") return prefs
    return {}
}

function getAvatarFromUser(user: any, displayName: string) {
    const prefs = safeParsePrefs(user?.prefs)

    const direct =
        String((user as any)?.avatar || (user as any)?.photoURL || (user as any)?.photoUrl || "").trim()

    const avatarUrl =
        String((user as any)?.avatarUrl || prefs?.avatarUrl || "").trim()

    const avatarFileId =
        String((user as any)?.avatarFileId || prefs?.avatarFileId || "").trim()

    // ✅ 1) best: stored URL from prefs
    if (avatarUrl) return avatarUrl

    // ✅ 2) fallback: build URL from fileId
    if (avatarFileId) {
        try {
            return String(storage.getFilePreview(BUCKET_ID, avatarFileId))
        } catch {
            // ignore
        }
    }

    // ✅ 3) fallback: any direct avatar field
    if (direct) return direct

    // ✅ 4) fallback: initials image
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
}

export function NavUser({
    className,
    showDetailsOnMobile,
    placement = "sidebar",
}: NavUserProps) {
    const navigate = useNavigate()
    const { isMobile, state } = useSidebar()
    const { user } = useSession()

    const displayName = user?.name || user?.email || "User"
    const email = user?.email || "—"

    // ✅ avatar fetched from prefs + bucket
    const avatar = React.useMemo(() => getAvatarFromUser(user, displayName), [user, displayName])

    const inHeader = placement === "header"

    /**
     * ✅ Sidebar collapsed logic should NOT affect header usage
     */
    const collapsed = !inHeader && state === "collapsed"

    /**
     * ✅ Header: show details on desktop, hide on mobile (unless forced)
     * ✅ Sidebar: show details when not collapsed (unless forced)
     */
    const showDetails = inHeader
        ? showDetailsOnMobile === true
            ? true
            : !isMobile
        : showDetailsOnMobile === true
            ? true
            : !collapsed

    /**
     * ✅ Fix dropdown direction
     * Header should open downward
     */
    const contentSide = inHeader ? "bottom" : isMobile ? "bottom" : "right"
    const contentAlign = inHeader ? "end" : collapsed ? "center" : "end"

    // ✅ AlertDialog open state
    const [logoutOpen, setLogoutOpen] = React.useState(false)
    const [logoutLoading, setLogoutLoading] = React.useState(false)

    async function onLogoutConfirmed() {
        if (logoutLoading) return
        setLogoutLoading(true)

        try {
            await authApi.logout()
            clearSessionCache()
            toast.success("Logged out successfully.")
            setLogoutOpen(false)
            navigate("/auth/login", { replace: true })
        } catch (e: any) {
            toast.error(e?.message || "Logout failed.")
        } finally {
            setLogoutLoading(false)
        }
    }

    /**
     * ✅ Logout menu item content (shared)
     */
    const LogoutMenuItem = (
        <DropdownMenuItem
            onSelect={(e) => {
                // ✅ Prevent dropdown auto close behavior breaking dialog trigger
                e.preventDefault()
                setLogoutOpen(true)
            }}
        >
            <IconLogout className="mr-2 size-4" />
            Log out
        </DropdownMenuItem>
    )

    /**
     * ✅ Alert Dialog (shared)
     */
    const LogoutAlertDialog = (
        <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Log out?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You will be signed out of your account and redirected to the login page.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={logoutLoading}>
                        Cancel
                    </AlertDialogCancel>

                    <AlertDialogAction
                        onClick={onLogoutConfirmed}
                        disabled={logoutLoading}
                    >
                        {logoutLoading ? "Logging out..." : "Continue"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )

    /**
     * ✅ HEADER VERSION (used in dashboard-header)
     */
    if (inHeader) {
        return (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="Open user menu"
                            className={cn(
                                "flex items-center gap-2 rounded-xl px-2 py-1",
                                "hover:bg-muted transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                className
                            )}
                        >
                            <Avatar className="h-9 w-9 rounded-xl shrink-0">
                                <AvatarImage src={avatar} alt={displayName} className="object-cover" />
                                <AvatarFallback className="rounded-xl">
                                    {initialsFromName(displayName)}
                                </AvatarFallback>
                            </Avatar>

                            {showDetails ? (
                                <div className="hidden sm:grid text-left text-sm leading-tight min-w-0">
                                    <span className="truncate font-medium max-w-40">{displayName}</span>
                                    <span className="truncate text-xs text-muted-foreground max-w-40">
                                        {email}
                                    </span>
                                </div>
                            ) : null}
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="min-w-56 rounded-lg"
                        side={contentSide}
                        align={contentAlign}
                        sideOffset={10}
                        avoidCollisions
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                                    <AvatarImage src={avatar} alt={displayName} className="object-cover" />
                                    <AvatarFallback className="rounded-lg">
                                        {initialsFromName(displayName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                                    <span className="truncate font-medium">{displayName}</span>
                                    <span className="text-muted-foreground truncate text-xs">{email}</span>
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

                        {/* ✅ Logout with AlertDialog */}
                        {LogoutMenuItem}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* ✅ Dialog rendered outside dropdown */}
                {LogoutAlertDialog}
            </>
        )
    }

    /**
     * ✅ SIDEBAR VERSION (default)
     */
    return (
        <>
            <SidebarMenu className={cn("w-full", collapsed && "flex items-center justify-center", className)}>
                <SidebarMenuItem className={cn("w-full", collapsed && "flex justify-center")}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            {collapsed ? (
                                <button
                                    type="button"
                                    aria-label="Open user menu"
                                    className={cn(
                                        "flex h-12 w-12 items-center justify-center rounded-xl",
                                        "bg-transparent",
                                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    )}
                                >
                                    <Avatar className="h-9 w-9 rounded-xl shrink-0">
                                        <AvatarImage src={avatar} alt={displayName} className="object-cover" />
                                        <AvatarFallback className="rounded-xl">
                                            {initialsFromName(displayName)}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            ) : (
                                <SidebarMenuButton
                                    size="lg"
                                    className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <Avatar className="h-8 w-8 rounded-lg shrink-0">
                                        <AvatarImage src={avatar} alt={displayName} className="object-cover" />
                                        <AvatarFallback className="rounded-lg">
                                            {initialsFromName(displayName)}
                                        </AvatarFallback>
                                    </Avatar>

                                    {showDetails ? (
                                        <>
                                            <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                                                <span className="truncate font-medium">{displayName}</span>
                                                <span className="text-muted-foreground truncate text-xs">
                                                    {email}
                                                </span>
                                            </div>

                                            {/* ✅ dots icon stays ONLY for sidebar */}
                                            <IconDotsVertical className="ml-auto size-4" />
                                        </>
                                    ) : (
                                        <span className="sr-only">Open user menu</span>
                                    )}
                                </SidebarMenuButton>
                            )}
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            className="min-w-56 rounded-lg"
                            side={contentSide}
                            align={contentAlign}
                            sideOffset={8}
                            avoidCollisions
                        >
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                                    <Avatar className="h-8 w-8 rounded-lg shrink-0">
                                        <AvatarImage src={avatar} alt={displayName} className="object-cover" />
                                        <AvatarFallback className="rounded-lg">
                                            {initialsFromName(displayName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                                        <span className="truncate font-medium">{displayName}</span>
                                        <span className="text-muted-foreground truncate text-xs">{email}</span>
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

                            {/* ✅ Logout with AlertDialog */}
                            {LogoutMenuItem}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            {/* ✅ Dialog rendered outside dropdown */}
            {LogoutAlertDialog}
        </>
    )
}
