/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, RefreshCcw, Pencil, Trash2, DoorOpen } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type RoomDoc = {
    $id: string
    code: string
    name?: string | null
    building?: string | null
    floor?: string | null
    capacity: number
    type: string
    isActive: boolean
}

type RoomTypeFilter = "ALL" | "LECTURE" | "LAB" | "OTHER"

// ✅ Shorter dialog + vertical scroll
const DIALOG_CONTENT_CLASS = "sm:max-w-2xl max-h-[75vh] overflow-y-auto"

function str(v: any) {
    return String(v ?? "").trim()
}

function num(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function toBool(v: any) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

function typeBadgeVariant(t: string) {
    const v = String(t || "").toUpperCase()
    if (v === "LAB") return "default"
    if (v === "LECTURE") return "secondary"
    return "outline"
}

function displayType(t: string) {
    const v = String(t || "").toUpperCase()
    if (v === "LAB") return "Lab"
    if (v === "LECTURE") return "Lecture"
    if (v === "OTHER") return "Other"
    return v || "Other"
}

async function listDocs(collectionId: string, queries: any[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries)
    return (res?.documents ?? []) as any[]
}

export default function AdminRoomsAndFacilitiesPage() {
    const [loading, setLoading] = React.useState(true)

    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [search, setSearch] = React.useState("")
    const [typeFilter, setTypeFilter] = React.useState<RoomTypeFilter>("ALL")
    const [onlyAvailable, setOnlyAvailable] = React.useState(false)

    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [editing, setEditing] = React.useState<RoomDoc | null>(null)

    const [roomCode, setRoomCode] = React.useState("")
    const [roomName, setRoomName] = React.useState("")
    const [roomBuilding, setRoomBuilding] = React.useState("")
    const [roomFloor, setRoomFloor] = React.useState("")
    const [roomCapacity, setRoomCapacity] = React.useState("30")
    const [roomType, setRoomType] = React.useState("LECTURE")
    const [roomAvailable, setRoomAvailable] = React.useState(true)

    const [deleteRoom, setDeleteRoom] = React.useState<RoomDoc | null>(null)

    const refreshRooms = React.useCallback(async () => {
        setLoading(true)
        try {
            const docs = await listDocs(COLLECTIONS.ROOMS, [
                Query.orderAsc("code"),
                Query.limit(2000),
            ])

            setRooms(
                docs.map((r: any) => ({
                    $id: r.$id,
                    code: str(r.code),
                    name: r.name ?? null,
                    building: r.building ?? null,
                    floor: r.floor ?? null,
                    capacity: num(r.capacity, 0),
                    type: str(r.type) || "OTHER",
                    isActive: toBool(r.isActive),
                }))
            )
        } catch (e: any) {
            toast.error(e?.message || "Failed to load rooms.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void refreshRooms()
    }, [refreshRooms])

    React.useEffect(() => {
        if (!dialogOpen) return

        if (!editing) {
            setRoomCode("")
            setRoomName("")
            setRoomBuilding("")
            setRoomFloor("")
            setRoomCapacity("30")
            setRoomType("LECTURE")
            setRoomAvailable(true)
            return
        }

        setRoomCode(editing.code)
        setRoomName(String(editing.name ?? ""))
        setRoomBuilding(String(editing.building ?? ""))
        setRoomFloor(String(editing.floor ?? ""))
        setRoomCapacity(String(editing.capacity ?? 0))
        setRoomType(String(editing.type ?? "OTHER"))
        setRoomAvailable(Boolean(editing.isActive))
    }, [dialogOpen, editing])

    async function saveRoom() {
        const payload: any = {
            code: str(roomCode),
            name: str(roomName) || null,
            building: str(roomBuilding) || null,
            floor: str(roomFloor) || null,
            capacity: num(roomCapacity, 0),
            type: str(roomType) || "OTHER",
            isActive: Boolean(roomAvailable),
        }

        if (!payload.code) {
            toast.error("Room code is required.")
            return
        }

        if (!Number.isFinite(payload.capacity) || payload.capacity <= 0) {
            toast.error("Capacity must be a valid number greater than 0.")
            return
        }

        try {
            if (editing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.ROOMS, editing.$id, payload)
                toast.success("Room updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.ROOMS, ID.unique(), payload)
                toast.success("Room created.")
            }

            setDialogOpen(false)
            setEditing(null)
            await refreshRooms()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save room.")
        }
    }

    async function confirmDelete() {
        if (!deleteRoom) return
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ROOMS, deleteRoom.$id)
            toast.success("Room deleted.")
            setDeleteRoom(null)
            await refreshRooms()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete room.")
        }
    }

    const q = search.trim().toLowerCase()

    const filteredRooms = React.useMemo(() => {
        let list = rooms

        if (typeFilter !== "ALL") {
            list = list.filter((r) => String(r.type || "").toUpperCase() === typeFilter)
        }

        if (onlyAvailable) {
            list = list.filter((r) => Boolean(r.isActive))
        }

        if (!q) return list

        return list.filter((r) => {
            const info = `${r.code} ${r.name ?? ""} ${r.building ?? ""} ${r.floor ?? ""} ${r.type}`
            return info.toLowerCase().includes(q)
        })
    }, [rooms, q, typeFilter, onlyAvailable])

    const total = rooms.length
    const availableCount = rooms.filter((r) => r.isActive).length
    const labs = rooms.filter((r) => String(r.type || "").toUpperCase() === "LAB").length
    const lectures = rooms.filter((r) => String(r.type || "").toUpperCase() === "LECTURE").length

    return (
        <DashboardLayout
            title="Rooms & Facilities"
            subtitle="Add/edit rooms, capacity, type, and availability."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refreshRooms()}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Room
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6">
                <Alert>
                    <AlertTitle className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4" />
                        Rooms & Facilities
                    </AlertTitle>
                    <AlertDescription>
                        Rooms are used in schedules and validations. Mark rooms as{" "}
                        <span className="font-medium">Available</span>{" "}
                        to include them in assignments.
                    </AlertDescription>
                </Alert>

                {/* Stats */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Rooms</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{total}</div>
                            <Badge variant="secondary">Total</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Available</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{availableCount}</div>
                            <Badge>Active</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Labs</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{labs}</div>
                            <Badge variant="outline">LAB</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Lecture Rooms</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{lectures}</div>
                            <Badge variant="secondary">LECTURE</Badge>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Manage Rooms</CardTitle>
                                <CardDescription>
                                    Add or update room details used by scheduling and workload rules.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search code / name / building..."
                                    className="sm:w-80"
                                />

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={onlyAvailable}
                                        onCheckedChange={(v) => setOnlyAvailable(Boolean(v))}
                                        id="only-available"
                                    />
                                    <Label htmlFor="only-available" className="text-sm">
                                        Available only
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <Tabs value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="ALL">All</TabsTrigger>
                                <TabsTrigger value="LECTURE">Lecture</TabsTrigger>
                                <TabsTrigger value="LAB">Lab</TabsTrigger>
                                <TabsTrigger value="OTHER">Other</TabsTrigger>
                            </TabsList>

                            <TabsContent value={typeFilter}>
                                {/* Table */}
                                {loading ? (
                                    <div className="space-y-3 pt-4">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredRooms.length === 0 ? (
                                    <div className="text-sm text-muted-foreground pt-4">
                                        No rooms found.
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden mt-4">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-36">Code</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="w-44">Building/Floor</TableHead>
                                                    <TableHead className="w-28">Capacity</TableHead>
                                                    <TableHead className="w-32">Type</TableHead>
                                                    <TableHead className="w-28">Available</TableHead>
                                                    <TableHead className="w-36 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredRooms.map((r) => (
                                                    <TableRow key={r.$id}>
                                                        <TableCell className="font-medium">{r.code}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {r.name || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            <div className="text-sm">
                                                                {r.building || "—"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.floor ? `Floor ${r.floor}` : ""}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{r.capacity}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={typeBadgeVariant(r.type)}>
                                                                {displayType(r.type)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={r.isActive ? "default" : "secondary"}>
                                                                {r.isActive ? "Yes" : "No"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setEditing(r)
                                                                        setDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4 mr-2" />
                                                                    Edit
                                                                </Button>

                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => setDeleteRoom(r)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardHeader>
                </Card>

                {/* Room Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Edit Room" : "Add Room"}</DialogTitle>
                            <DialogDescription>
                                Define room details for scheduling and workload capacity checks.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                                <Label>Room Code</Label>
                                <Input
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                    placeholder="e.g. R-101 / LAB-2"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Room Name (optional)</Label>
                                <Input
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="e.g. Computer Laboratory 1"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Building (optional)</Label>
                                    <Input
                                        value={roomBuilding}
                                        onChange={(e) => setRoomBuilding(e.target.value)}
                                        placeholder="e.g. CCS Building"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Floor (optional)</Label>
                                    <Input
                                        value={roomFloor}
                                        onChange={(e) => setRoomFloor(e.target.value)}
                                        placeholder="e.g. 2"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Capacity</Label>
                                    <Input
                                        value={roomCapacity}
                                        onChange={(e) => setRoomCapacity(e.target.value)}
                                        inputMode="numeric"
                                        placeholder="e.g. 30"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Room Type</Label>
                                    <Select value={roomType} onValueChange={setRoomType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LECTURE">Lecture</SelectItem>
                                            <SelectItem value="LAB">Lab</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={roomAvailable}
                                    onCheckedChange={(v) => setRoomAvailable(Boolean(v))}
                                    id="room-available"
                                />
                                <Label htmlFor="room-available">Available (Active)</Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => void saveRoom()}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <AlertDialog open={Boolean(deleteRoom)} onOpenChange={(open) => (!open ? setDeleteRoom(null) : null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Room</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete room{" "}
                                <span className="font-medium">{deleteRoom?.code}</span>. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void confirmDelete()}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}
