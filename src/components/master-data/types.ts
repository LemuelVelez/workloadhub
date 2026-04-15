/* eslint-disable @typescript-eslint/no-explicit-any */

export type CollegeDoc = {
    $id: string
    code: string
    name: string
    isActive: boolean
}

export type ProgramDoc = {
    $id: string
    departmentId: string
    code: string
    name: string
    description?: string | null
    isActive: boolean
}

export type SubjectDoc = {
    $id: string
    termId?: string | null
    departmentId?: string | null
    programId?: string | null
    programIds?: string[] | null
    yearLevel?: string | number | null
    yearLevels?: Array<string | number> | null
    semester?: string | null
    code: string
    title: string
    units: number
    lectureHours: number
    labHours: number
    totalHours?: number | null
    isActive: boolean
}

export type AcademicTermDoc = {
    $id: string
    schoolYear: string
    semester: string
    startDate?: string | null
    endDate?: string | null
    isActive: boolean
    isLocked: boolean
}

export type SectionDoc = {
    $id: string
    termId?: string | null
    departmentId: string
    programId?: string | null
    subjectId?: string | null
    subjectIds?: string[] | null
    yearLevel: string | number
    semester?: string | null
    academicTermLabel?: string | null
    name: string
    studentCount?: number | null
    isActive: boolean
}

export type UserProfileDoc = {
    $id: string
    userId: string
    email: string
    name?: string | null
    role: string
    departmentId?: string | null
    isActive: boolean
}

export type FacultyProfileDoc = {
    $id: string
    userId: string
    employeeNo?: string | null
    departmentId: string
    rank?: string | null
    maxUnits?: number | null
    maxHours?: number | null
    notes?: string | null
}

export type RoomDoc = {
    $id: string
    code: string
    name?: string | null
    isActive: boolean
}

export type ClassDoc = {
    $id: string
    versionId?: string | null
    termId: string
    departmentId: string
    programId?: string | null
    sectionId?: string | null
    subjectId?: string | null
    facultyUserId?: string | null
    classCode?: string | null
    status?: string | null
}

export type ClassMeetingDoc = {
    $id: string
    versionId?: string | null
    classId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    meetingType?: string | null
}

export type ListRecordRow = {
    id: string
    termId: string
    termLabel: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    roomLabel: string
    facultyUserId?: string | null
    facultyLabel: string
    subjectId?: string | null
    subjectCode: string
    subjectTitle: string
    units?: number | null
    classCode: string
    collegeLabel: string
    programLabel: string
    sectionId?: string | null
    sectionProgramId?: string | null
    sectionYearLevel?: string | null
    sectionLabel: string
}

export type MasterTab = "colleges" | "programs" | "subjects" | "faculty" | "sections" | "records"

export type DeleteIntent =
    | { type: "college"; doc: CollegeDoc }
    | { type: "program"; doc: ProgramDoc }
    | { type: "subject"; doc: SubjectDoc }
    | { type: "subjects"; docs: SubjectDoc[]; scope: "selected" | "visible" }
    | { type: "faculty"; doc: FacultyProfileDoc }
    | { type: "section"; doc: SectionDoc }

export const FACULTY_ROLES = ["FACULTY", "CHAIR", "DEAN"] as const

export const DIALOG_CONTENT_CLASS = "sm:max-w-2xl max-h-[95svh] overflow-y-auto"

export const YEAR_LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6] as const

export function str(v: any) {
    return String(v ?? "").trim()
}

export function num(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

export function toBool(v: any) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

export function collegeLabel(colleges: CollegeDoc[], collegeId: string | null | undefined) {
    const id = String(collegeId ?? "").trim()
    if (!id) return "—"
    const d = colleges.find((x) => x.$id === id)
    if (!d) return "Unknown"
    return `${d.code} — ${d.name}`
}

export function programLabel(programs: ProgramDoc[], programId: string | null | undefined) {
    const id = String(programId ?? "").trim()
    if (!id) return "—"
    const p = programs.find((x) => x.$id === id)
    if (!p) return "Unknown"
    return `${p.code} — ${p.name}`
}

export function termLabel(terms: AcademicTermDoc[], termId: string | null | undefined) {
    const id = String(termId ?? "").trim()
    if (!id) return "—"
    const t = terms.find((x) => x.$id === id)
    if (!t) return "Unknown"
    const sy = str(t.schoolYear)
    const sem = str(t.semester)
    return sy && sem ? `${sy} • ${sem}` : sy || sem || "Term"
}

export function facultyDisplay(u?: UserProfileDoc | null) {
    if (!u) return "Unknown faculty"
    const name = str(u.name) || "Unnamed"
    const email = str(u.email)
    return email ? `${name} (${email})` : name
}

export function detectDefaultCollegeId(colleges: CollegeDoc[]) {
    const exact = colleges.find((c) => str(c.name).toLowerCase() === "college of computing studies")
    if (exact) return exact.$id

    const fuzzy = colleges.find((c) => {
        const code = str(c.code).toLowerCase()
        const name = str(c.name).toLowerCase()
        return code === "ccs" || name.includes("computing studies")
    })
    if (fuzzy) return fuzzy.$id

    return colleges[0]?.$id ?? ""
}

export function parseTimeToMinutes(value: string) {
    const v = str(value)
    const m = /^(\d{1,2}):(\d{2})/.exec(v)
    if (!m) return -1
    const h = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return -1
    return h * 60 + mm
}

export function isTimeOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    const as = parseTimeToMinutes(aStart)
    const ae = parseTimeToMinutes(aEnd)
    const bs = parseTimeToMinutes(bStart)
    const be = parseTimeToMinutes(bEnd)

    if (as < 0 || ae < 0 || bs < 0 || be < 0) return false
    if (as >= ae || bs >= be) return false
    return as < be && bs < ae
}