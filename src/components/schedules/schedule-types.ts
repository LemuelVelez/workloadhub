export type ScheduleStatus = "Draft" | "Active" | "Archived" | (string & {})
export type MeetingType = "LECTURE" | "LAB" | "OTHER" | (string & {})

export type ScheduleVersionDoc = {
    $id: string
    $createdAt: string
    $updatedAt: string
    termId: string
    departmentId: string
    version: number
    label?: string | null
    status: ScheduleStatus
    createdBy: string
    lockedBy?: string | null
    lockedAt?: string | null
    notes?: string | null
}

export type DepartmentDoc = {
    $id: string
    name?: string | null
    code?: string | null
    isActive?: boolean
}

export type AcademicTermDoc = {
    $id: string
    schoolYear?: string | null
    semester?: string | null
    startDate?: string | null
    endDate?: string | null
    isActive?: boolean
    isLocked?: boolean
}

export type SubjectDoc = {
    $id: string
    termId?: string | null
    departmentId?: string | null
    code?: string | null
    title?: string | null
    units?: number | null
    isActive?: boolean
}

export type RoomDoc = {
    $id: string
    code?: string | null
    name?: string | null
    building?: string | null
    floor?: string | null
    capacity?: number | null
    type?: string | null
    isActive?: boolean
}

export type SectionDoc = {
    $id: string
    termId: string
    departmentId: string
    yearLevel?: string | number | null
    name?: string | null
    label?: string | null
    programCode?: string | null
    programName?: string | null
    isActive?: boolean
}

export type UserProfileDoc = {
    $id: string
    userId?: string | null
    email?: string | null
    name?: string | null
    role?: string | null
    isActive?: boolean
}

export type ClassDoc = {
    $id: string
    versionId: string
    termId: string
    departmentId: string
    programId?: string | null
    sectionId: string
    subjectId: string
    facultyUserId?: string | null
    classCode?: string | null
    deliveryMode?: string | null
    status?: string | null
    remarks?: string | null
}

export type ClassMeetingDoc = {
    $id: string
    versionId: string
    classId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    meetingType: MeetingType
    notes?: string | null
}

export type TabKey = "all" | "Draft" | "Active" | "Archived"
export type ConflictType = "room" | "faculty" | "section"

export type ConflictFlags = {
    room: boolean
    faculty: boolean
    section: boolean
}

export type ScheduleRow = {
    meetingId: string
    classId: string

    versionId: string
    termId: string
    departmentId: string

    dayOfWeek: string
    startTime: string
    endTime: string
    meetingType: MeetingType

    roomId: string
    roomType: string
    roomLabel: string

    sectionId: string
    sectionLabel: string
    sectionYearLevel?: string | number | null
    sectionName?: string | null
    sectionProgramCode?: string | null
    sectionProgramName?: string | null

    subjectId: string
    subjectLabel: string
    subjectUnits: number | null

    facultyUserId: string
    facultyName: string
    manualFaculty: string
    facultyKey: string
    isManualFaculty: boolean

    classCode: string
    deliveryMode: string
    classStatus: string
    classRemarks: string
}

export type CandidateConflict = {
    type: ConflictType
    row: ScheduleRow
}

export type VersionStats = {
    total: number
    draft: number
    active: number
    archived: number
}

export type PlannerStats = {
    total: number
    conflicts: number
    labs: number
}

export type VersionSelectOption = {
    value: string
    label: string
    meta: string
}

export const BASE_DAY_OPTIONS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

export const DAY_ABBREVIATIONS: Record<(typeof BASE_DAY_OPTIONS)[number], string> = {
    Monday: "M",
    Tuesday: "T",
    Wednesday: "W",
    Thursday: "TH",
    Friday: "F",
    Saturday: "SAT",
    Sunday: "SUN",
}

export const DAY_OPTIONS: ReadonlyArray<string> = [
    ...BASE_DAY_OPTIONS,
    ...BASE_DAY_OPTIONS.flatMap((day, index) =>
        BASE_DAY_OPTIONS.slice(index + 1).map((otherDay) => `${DAY_ABBREVIATIONS[day]}-${DAY_ABBREVIATIONS[otherDay]}`)
    ),
]

export const FACULTY_OPTION_NONE = "__none__"
export const FACULTY_OPTION_MANUAL = "__manual__"
