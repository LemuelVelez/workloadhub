/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useLocation, useNavigate, Link } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { NavUser } from "@/components/nav-user"

import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

export type DashboardHeaderProps = {
    title?: string
    subtitle?: string
    actions?: React.ReactNode
    className?: string
}

type SearchItemType = "workspace" | "evidence" | "user" | "template" | "review_item"

type SearchItem = {
    type: SearchItemType
    id: string
    title: string
    subtitle?: string
    href: string
}

type SearchOk = { ok: true; items: SearchItem[] }
type SearchErr = { ok: false; error?: string }
type SearchRes = SearchOk | SearchErr

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

function typeLabel(t: SearchItemType) {
    if (t === "workspace") return "Workspaces"
    if (t === "evidence") return "Evidence"
    if (t === "user") return "Users"
    if (t === "template") return "Templates"
    return "Reviews"
}

function typeBadge(t: SearchItemType) {
    if (t === "workspace") return "Workspace"
    if (t === "evidence") return "Evidence"
    if (t === "user") return "User"
    if (t === "template") return "Template"
    return "Review"
}

/**
 * Avoids: Failed to execute 'json' on 'Response': Unexpected end of JSON input
 */
async function readJsonSafe<T = unknown>(res: Response): Promise<T | null> {
    const text = await res.text()
    if (!text || !text.trim()) return null
    try {
        return JSON.parse(text) as T
    } catch {
        return null
    }
}

export default function DashboardHeader({
    title,
    subtitle,
    actions,
    className,
}: DashboardHeaderProps) {
    const location = useLocation()
    const navigate = useNavigate()

    const pathname = location.pathname ?? ""
    const derivedTitle = title ?? titleFromPath(pathname)

    const [q, setQ] = React.useState("")
    const [open, setOpen] = React.useState(false)
    const [mobileOpen, setMobileOpen] = React.useState(false)
    const [items, setItems] = React.useState<SearchItem[]>([])
    const [loading, setLoading] = React.useState(false)

    const abortRef = React.useRef<AbortController | null>(null)
    const debounceRef = React.useRef<number | null>(null)

    const runSearch = React.useCallback(async (query: string) => {
        const trimmed = query.trim()
        if (trimmed.length < 2) {
            setItems([])
            setLoading(false)
            return
        }

        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setLoading(true)

        try {
            const res = await fetch(
                `/api/search?q=${encodeURIComponent(trimmed)}&limit=12`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    signal: controller.signal,
                }
            )

            const json = await readJsonSafe<SearchRes>(res)

            if (!res.ok) {
                const msg =
                    (json as SearchErr | null)?.error || `Search failed (HTTP ${res.status})`

                if (res.status === 401) toast.error("Session expired. Please sign in again.")
                else toast.error(msg)

                setItems([])
                return
            }

            if (!json || (json as any)?.ok !== true) {
                const msg = (json as SearchErr | null)?.error || "Search failed"
                toast.error(msg)
                setItems([])
                return
            }

            setItems((json as SearchOk).items ?? [])
        } catch (e: any) {
            if (e?.name === "AbortError") return
            toast.error(e?.message || "Search failed")
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current)
        const next = q

        debounceRef.current = window.setTimeout(() => {
            void runSearch(next)
        }, 250)

        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current)
        }
    }, [q, runSearch])

    const grouped = React.useMemo(() => {
        const map = new Map<SearchItemType, SearchItem[]>()
        for (const it of items) {
            const arr = map.get(it.type) ?? []
            arr.push(it)
            map.set(it.type, arr)
        }
        return map
    }, [items])

    const onPick = React.useCallback(
        (it: SearchItem) => {
            setOpen(false)
            setMobileOpen(false)
            setQ("")
            navigate(it.href)
        },
        [navigate]
    )

    const SearchBox = (
        <div className="relative min-w-0 w-64 xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                value={q}
                onChange={(e) => {
                    setQ(e.target.value)
                    setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search workspaces, evidence, users…"
                className="w-full min-w-0 pl-9"
            />
        </div>
    )

    const Results = (
        <Command shouldFilter={false}>
            <CommandList>
                {q.trim().length < 2 ? (
                    <CommandEmpty>Type at least 2 characters…</CommandEmpty>
                ) : loading ? (
                    <div className="space-y-2 p-3 min-w-0">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                ) : items.length === 0 ? (
                    <CommandEmpty>No results.</CommandEmpty>
                ) : (
                    <>
                        {Array.from(grouped.entries()).map(([t, arr]) => (
                            <CommandGroup key={t} heading={typeLabel(t)}>
                                {arr.slice(0, 6).map((it) => (
                                    <CommandItem
                                        key={`${it.type}:${it.id}`}
                                        value={`${it.type}:${it.id}`}
                                        onSelect={() => onPick(it)}
                                        className="flex items-start gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="truncate text-sm font-medium">{it.title}</span>
                                                <Badge variant="secondary" className="shrink-0">
                                                    {typeBadge(it.type)}
                                                </Badge>
                                            </div>
                                            {it.subtitle ? (
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {it.subtitle}
                                                </div>
                                            ) : null}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </>
                )}
            </CommandList>
        </Command>
    )

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

                <div className="hidden min-w-0 items-center justify-end gap-2 lg:flex">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>{SearchBox}</PopoverTrigger>
                        <PopoverContent
                            align="start"
                            sideOffset={8}
                            className="p-0 w-80 sm:w-96"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            {Results}
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-6 shrink-0" />

                    {actions ? (
                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                            {actions}
                        </div>
                    ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        className="lg:hidden"
                        aria-label="Search"
                        onClick={() => setMobileOpen(true)}
                    >
                        <Search className="h-4 w-4" />
                    </Button>

                    {/* ✅ FIX: dropdown opens downward + removed dots icon */}
                    <NavUser placement="header" />
                </div>
            </div>

            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogContent className="sm:max-w-lg max-w-full">
                    <DialogHeader>
                        <DialogTitle>Search</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 min-w-0">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search workspaces, evidence, users…"
                                className="w-full min-w-0 pl-9"
                                autoFocus
                            />
                        </div>

                        <div className="overflow-hidden rounded-lg border bg-card min-w-0">
                            {Results}
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Search results are filtered automatically based on your role.
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setMobileOpen(false)}>
                                Close
                            </Button>

                            <Button asChild onClick={() => setMobileOpen(false)}>
                                <Link to="/dashboard">Go to dashboard</Link>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </header>
    )
}
