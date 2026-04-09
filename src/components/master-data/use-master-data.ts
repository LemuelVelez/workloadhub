/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"
import { SECTION_NAME_OPTIONS } from "@/model/schemaModel"
import {
    FACULTY_ROLES,
    YEAR_LEVEL_OPTIONS,
    collegeLabel,
    detectDefaultCollegeId,
    facultyDisplay,
    isTimeOverlap,
    num,
    programLabel,
    str,
    termLabel,
    toBool,
} from "./types"
import type {
    AcademicTermDoc,
    ClassDoc,
    ClassMeetingDoc,
    CollegeDoc,
    DeleteIntent,
    FacultyProfileDoc,
    ListRecordRow,
    MasterTab,
    ProgramDoc,
    RoomDoc,
    SectionDoc,
    SubjectDoc,
    UserProfileDoc,
} from "./types"

const SUBJECT_TERM_KEYS = ["termId", "academicTermId", "term", "term_id", "termID"] as const
const SUBJECT_PROGRAM_KEYS = ["programId", "program", "program_id", "programID"] as const
const SUBJECT_PROGRAM_ARRAY_KEYS = ["programIds", "program_ids"] as const
const SUBJECT_SCOPE_YEAR_LEVEL_KEYS = ["yearLevel", "sectionYearLevel", "sectionYear", "year_level"] as const
const SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS = ["yearLevels", "year_levels"] as const
const SUBJECT_SEMESTER_KEYS = ["semester", "semesterLabel", "termSemester", "termSem"] as const

async function listDocs(collectionId: string, queries: any[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries)
    return (res?.documents ?? []) as any[]
}

function readFirstStringValue(
    source: Record<string, unknown> | null | undefined,
    keys: readonly string[]
) {
    for (const key of keys) {
        const value = source?.[key]
        if (typeof value === "string" && value.trim()) {
            return value.trim()
        }
    }
    return ""
}

function readStringArrayValues(
    source: Record<string, unknown> | null | undefined,
    arrayKeys: readonly string[],
    fallbackStringKeys: readonly string[] = []
) {
    const values: string[] = []

    for (const key of arrayKeys) {
        const value = source?.[key]

        if (Array.isArray(value)) {
            for (const item of value) {
                const normalized = str(item)
                if (normalized) values.push(normalized)
            }
            continue
        }

        if (typeof value === "string" && value.trim()) {
            const parts = value.includes(",") ? value.split(",") : [value]
            for (const part of parts) {
                const normalized = str(part)
                if (normalized) values.push(normalized)
            }
        }
    }

    if (values.length === 0) {
        for (const key of fallbackStringKeys) {
            const normalized = str(source?.[key])
            if (normalized) values.push(normalized)
        }
    }

    return Array.from(new Set(values))
}

function hasOwnKey(source: Record<string, unknown> | null | undefined, key: string) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key)
}

function buildSubjectTermPayload(
    source: Record<string, unknown> | null | undefined,
    termIdInput?: string | null
) {
    const nextValue = str(termIdInput) || null
    const existingKeys = SUBJECT_TERM_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["termId"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}


function buildSubjectProgramPayload(
    source: Record<string, unknown> | null | undefined,
    programIdInput?: string | null
) {
    const nextValue = str(programIdInput) || null
    const existingKeys = SUBJECT_PROGRAM_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["programId"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectProgramIdsPayload(
    source: Record<string, unknown> | null | undefined,
    programIdsInput: string[] = []
) {
    const nextValue = Array.from(new Set(programIdsInput.map((value) => str(value)).filter(Boolean)))
    const existingKeys = SUBJECT_PROGRAM_ARRAY_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["programIds"]

    return keysToUpdate.reduce<Record<string, string[]>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectYearLevelPayload(
    source: Record<string, unknown> | null | undefined,
    yearLevelInput?: string | number | null,
    programIdInput?: string | null,
    programs: ProgramDoc[] = []
) {
    const normalizedYearLevel = buildStoredSectionYearLevel(
        yearLevelInput,
        programIdInput,
        programs
    )
    const nextValue = normalizedYearLevel || null
    const existingKeys = SUBJECT_SCOPE_YEAR_LEVEL_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["yearLevel"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectYearLevelsPayload(
    source: Record<string, unknown> | null | undefined,
    yearLevelsInput: Array<string | number> = []
) {
    const nextValue = Array.from(
        new Set(
            yearLevelsInput
                .map((value) => extractSectionYearNumber(value) || normalizeSectionYearLevelValue(value))
                .filter(Boolean)
        )
    )
    const existingKeys = SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["yearLevels"]

    return keysToUpdate.reduce<Record<string, string[]>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectSemesterPayload(
    source: Record<string, unknown> | null | undefined,
    semesterInput?: string | null
) {
    const nextValue = str(semesterInput) || null
    const existingKeys = SUBJECT_SEMESTER_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["semester"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function resolveSubjectProgramIds(source: Record<string, unknown> | null | undefined) {
    return readStringArrayValues(source, SUBJECT_PROGRAM_ARRAY_KEYS, SUBJECT_PROGRAM_KEYS)
}

function resolveSubjectProgramId(source: Record<string, unknown> | null | undefined) {
    return resolveSubjectProgramIds(source)[0] ?? readFirstStringValue(source, SUBJECT_PROGRAM_KEYS)
}

function resolveSubjectYearLevels(source: Record<string, unknown> | null | undefined) {
    return Array.from(
        new Set(
            readStringArrayValues(
                source,
                SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS,
                SUBJECT_SCOPE_YEAR_LEVEL_KEYS
            )
                .map((value) => extractSectionYearNumber(value) || normalizeSectionYearLevelValue(value))
                .filter(Boolean)
        )
    )
}

function resolveSubjectYearLevel(
    source: Record<string, unknown> | null | undefined,
    programs: ProgramDoc[]
) {
    const primaryYearLevel = resolveSubjectYearLevels(source)[0] ?? readFirstStringValue(source, SUBJECT_SCOPE_YEAR_LEVEL_KEYS)
    const programId = resolveSubjectProgramId(source)

    return (
        buildStoredSectionYearLevel(primaryYearLevel, programId, programs) ||
        normalizeSectionYearLevelValue(primaryYearLevel)
    )
}

function normalizeSectionYearLevelValue(value?: string | number | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
}

function extractSectionYearNumber(value?: string | number | null) {
    const normalized = normalizeSectionYearLevelValue(value)
    if (!normalized) return ""

    const direct = normalized.match(/^([1-9]\d*)$/)
    if (direct) return direct[1]

    const prefixed = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/)
    if (prefixed) return prefixed[1]

    const trailing = normalized.match(/(?:^|[\s-])([1-9]\d*)$/)
    return trailing?.[1] ?? ""
}

function normalizeSectionNameValue(value?: string | null) {
    const normalized = String(value ?? "").trim()
    if (!normalized) return ""

    const matched = SECTION_NAME_OPTIONS.find(
        (option) => option.toUpperCase() === normalized.toUpperCase()
    )

    return matched ?? normalized
}

function resolveSectionProgramPrefix(
    programs: ProgramDoc[],
    programId?: string | null
) {
    const normalizedProgramId = str(programId)
    if (!normalizedProgramId) return ""

    const matchedProgram = programs.find(
        (program) => str(program.$id) === normalizedProgramId
    )

    const normalizedCode = str(matchedProgram?.code)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")

    if (!normalizedCode) return ""
    if (normalizedCode === "CS" || normalizedCode === "BSCS" || normalizedCode.endsWith("CS")) {
        return "CS"
    }
    if (normalizedCode === "IS" || normalizedCode === "BSIS" || normalizedCode.endsWith("IS")) {
        return "IS"
    }

    return ""
}

function buildStoredSectionYearLevel(
    value: string | number | null | undefined,
    programId: string | null | undefined,
    programs: ProgramDoc[]
) {
    const normalizedYearLevel = normalizeSectionYearLevelValue(value)
    const yearNumber = extractSectionYearNumber(normalizedYearLevel)
    const programPrefix = resolveSectionProgramPrefix(programs, programId)

    if (!normalizedYearLevel) return ""
    if (!yearNumber) return normalizedYearLevel
    if (!programPrefix) return normalizedYearLevel
    if (normalizedYearLevel.startsWith(`${programPrefix} `)) return normalizedYearLevel

    return `${programPrefix} ${yearNumber}`
}

function buildSectionDisplayLabel(
    yearLevel?: string | number | null,
    name?: string | null
) {
    const normalizedYearLevel = normalizeSectionYearLevelValue(yearLevel)
    const normalizedName = normalizeSectionNameValue(name)

    if (!normalizedYearLevel && !normalizedName) return "—"
    if (!normalizedYearLevel) return normalizedName
    if (!normalizedName) return normalizedYearLevel

    return `${normalizedYearLevel} - ${normalizedName}`
}

export function useMasterDataManagement() {
    const [tab, setTab] = React.useState<MasterTab>("colleges")
    const [loading, setLoading] = React.useState(true)

    const [colleges, setColleges] = React.useState<CollegeDoc[]>([])
    const [programs, setPrograms] = React.useState<ProgramDoc[]>([])
    const [subjects, setSubjects] = React.useState<SubjectDoc[]>([])
    const [facultyProfiles, setFacultyProfiles] = React.useState<FacultyProfileDoc[]>([])
    const [facultyUsers, setFacultyUsers] = React.useState<UserProfileDoc[]>([])

    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [sections, setSections] = React.useState<SectionDoc[]>([])
    const [selectedTermId, setSelectedTermId] = React.useState("")

    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [classes, setClasses] = React.useState<ClassDoc[]>([])
    const [classMeetings, setClassMeetings] = React.useState<ClassMeetingDoc[]>([])

    const [search, setSearch] = React.useState("")

    const [deleteIntent, setDeleteIntent] = React.useState<DeleteIntent | null>(null)

    const defaultCollegeId = React.useMemo(() => detectDefaultCollegeId(colleges), [colleges])

    const refreshAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [
                collegeDocs,
                programDocs,
                subjectDocs,
                facultyProfileDocs,
                userProfileDocs,
                termDocs,
                sectionDocs,
                roomDocs,
                classDocs,
                classMeetingDocs,
            ] = await Promise.all([
                listDocs(COLLECTIONS.DEPARTMENTS, [Query.orderAsc("name"), Query.limit(200)]),
                listDocs(COLLECTIONS.PROGRAMS, [Query.orderAsc("name"), Query.limit(1000)]),
                listDocs(COLLECTIONS.SUBJECTS, [Query.orderAsc("code"), Query.limit(3000)]),
                listDocs(COLLECTIONS.FACULTY_PROFILES, [Query.orderAsc("$createdAt"), Query.limit(3000)]),
                listDocs(COLLECTIONS.USER_PROFILES, [Query.orderAsc("name"), Query.limit(3000)]),
                listDocs(COLLECTIONS.ACADEMIC_TERMS, [Query.orderDesc("$createdAt"), Query.limit(500)]),
                listDocs(COLLECTIONS.SECTIONS, [Query.orderDesc("$createdAt"), Query.limit(5000)]),
                listDocs(COLLECTIONS.ROOMS, [Query.orderAsc("code"), Query.limit(2000)]),
                listDocs(COLLECTIONS.CLASSES, [Query.orderDesc("$createdAt"), Query.limit(10000)]),
                listDocs(COLLECTIONS.CLASS_MEETINGS, [Query.orderDesc("$createdAt"), Query.limit(10000)]),
            ])

            setColleges(
                collegeDocs.map((d: any) => ({
                    $id: d.$id,
                    code: str(d.code),
                    name: str(d.name),
                    isActive: toBool(d.isActive),
                }))
            )

            const mappedPrograms: ProgramDoc[] = programDocs.map((p: any) => ({
                $id: p.$id,
                departmentId: str(p.departmentId),
                code: str(p.code),
                name: str(p.name),
                description: p.description ?? null,
                isActive: toBool(p.isActive),
            }))

            setPrograms(mappedPrograms)

            setSubjects(
                subjectDocs.map((s: any) => ({
                    ...s,
                    $id: s.$id,
                    termId: readFirstStringValue(s, SUBJECT_TERM_KEYS) || null,
                    departmentId: s.departmentId ? str(s.departmentId) : null,
                    programId: resolveSubjectProgramId(s) || null,
                    programIds: resolveSubjectProgramIds(s),
                    yearLevel: resolveSubjectYearLevel(s, mappedPrograms) || null,
                    yearLevels: resolveSubjectYearLevels(s),
                    semester: readFirstStringValue(s, SUBJECT_SEMESTER_KEYS) || null,
                    code: str(s.code),
                    title: str(s.title),
                    units: num(s.units, 0),
                    lectureHours: num(s.lectureHours, 0),
                    labHours: num(s.labHours, 0),
                    totalHours: s.totalHours != null ? num(s.totalHours, 0) : null,
                    isActive: toBool(s.isActive),
                }))
            )

            setFacultyProfiles(
                facultyProfileDocs.map((f: any) => ({
                    $id: f.$id,
                    userId: str(f.userId),
                    employeeNo: f.employeeNo ?? null,
                    departmentId: str(f.departmentId),
                    rank: f.rank ?? null,
                    maxUnits: f.maxUnits != null ? num(f.maxUnits, 0) : null,
                    maxHours: f.maxHours != null ? num(f.maxHours, 0) : null,
                    notes: f.notes ?? null,
                }))
            )

            const mappedUsers: UserProfileDoc[] = (userProfileDocs ?? []).map((u: any) => ({
                $id: u.$id,
                userId: str(u.userId),
                email: str(u.email),
                name: u.name ?? null,
                role: str(u.role),
                departmentId: u.departmentId ? str(u.departmentId) : null,
                isActive: toBool(u.isActive),
            }))

            const filteredFacultyUsers = mappedUsers
                .filter((u) => FACULTY_ROLES.includes(str(u.role).toUpperCase() as any))
                .filter((u) => Boolean(u.userId))
                .sort((a, b) => facultyDisplay(a).localeCompare(facultyDisplay(b)))

            setFacultyUsers(filteredFacultyUsers)

            const mappedTerms: AcademicTermDoc[] = (termDocs ?? []).map((t: any) => ({
                $id: t.$id,
                schoolYear: str(t.schoolYear),
                semester: str(t.semester),
                startDate: t.startDate ?? null,
                endDate: t.endDate ?? null,
                isActive: toBool(t.isActive),
                isLocked: toBool(t.isLocked),
            }))
            setTerms(mappedTerms)

            setSelectedTermId((prev) => {
                if (str(prev)) return prev
                const active = mappedTerms.find((x) => x.isActive)
                return active?.$id || mappedTerms[0]?.$id || ""
            })

            setSections(
                (sectionDocs ?? []).map((s: any) => {
                    const programId = s.programId ? str(s.programId) : null
                    return {
                        $id: s.$id,
                        termId: str(s.termId),
                        departmentId: str(s.departmentId),
                        programId,
                        yearLevel:
                            (buildStoredSectionYearLevel(
                                s.yearLevel,
                                programId,
                                mappedPrograms
                            ) ||
                                normalizeSectionYearLevelValue(s.yearLevel) ||
                                "1") as any,
                        name: normalizeSectionNameValue(s.name),
                        studentCount: s.studentCount != null ? num(s.studentCount, 0) : null,
                        isActive: toBool(s.isActive),
                    }
                })
            )

            setRooms(
                (roomDocs ?? []).map((r: any) => ({
                    $id: r.$id,
                    code: str(r.code),
                    name: r.name ?? null,
                    isActive: toBool(r.isActive),
                }))
            )

            setClasses(
                (classDocs ?? []).map((c: any) => ({
                    $id: c.$id,
                    versionId: c.versionId ? str(c.versionId) : null,
                    termId: str(c.termId),
                    departmentId: str(c.departmentId),
                    programId: c.programId ? str(c.programId) : null,
                    sectionId: c.sectionId ? str(c.sectionId) : null,
                    subjectId: c.subjectId ? str(c.subjectId) : null,
                    facultyUserId: c.facultyUserId ? str(c.facultyUserId) : null,
                    classCode: c.classCode ? str(c.classCode) : null,
                    status: c.status ? str(c.status) : null,
                }))
            )

            setClassMeetings(
                (classMeetingDocs ?? []).map((m: any) => ({
                    $id: m.$id,
                    versionId: m.versionId ? str(m.versionId) : null,
                    classId: str(m.classId),
                    dayOfWeek: str(m.dayOfWeek),
                    startTime: str(m.startTime),
                    endTime: str(m.endTime),
                    roomId: m.roomId ? str(m.roomId) : null,
                    meetingType: m.meetingType ? str(m.meetingType) : null,
                }))
            )
        } catch (e: any) {
            toast.error(e?.message || "Failed to load Master Data.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void refreshAll()
    }, [refreshAll])

    const facultyUserMap = React.useMemo(() => {
        const m = new Map<string, UserProfileDoc>()
        for (const u of facultyUsers) {
            if (u.userId) m.set(u.userId, u)
        }
        return m
    }, [facultyUsers])

    const subjectMap = React.useMemo(() => {
        const m = new Map<string, SubjectDoc>()
        for (const s of subjects) m.set(s.$id, s)
        return m
    }, [subjects])

    const sectionMap = React.useMemo(() => {
        const m = new Map<string, SectionDoc>()
        for (const section of sections) m.set(section.$id, section)
        return m
    }, [sections])

    const classMap = React.useMemo(() => {
        const m = new Map<string, ClassDoc>()
        for (const c of classes) m.set(c.$id, c)
        return m
    }, [classes])

    const roomMap = React.useMemo(() => {
        const m = new Map<string, RoomDoc>()
        for (const r of rooms) m.set(r.$id, r)
        return m
    }, [rooms])

    // -----------------------------
    // Colleges dialog state
    // -----------------------------
    const [collegeOpen, setCollegeOpen] = React.useState(false)
    const [collegeEditing, setCollegeEditing] = React.useState<CollegeDoc | null>(null)

    const [collegeCode, setCollegeCode] = React.useState("")
    const [collegeName, setCollegeName] = React.useState("")
    const [collegeActive, setCollegeActive] = React.useState(true)

    React.useEffect(() => {
        if (!collegeOpen) return
        if (!collegeEditing) {
            setCollegeCode("CCS")
            setCollegeName("College of Computing Studies")
            setCollegeActive(true)
            return
        }
        setCollegeCode(collegeEditing.code)
        setCollegeName(collegeEditing.name)
        setCollegeActive(Boolean(collegeEditing.isActive))
    }, [collegeOpen, collegeEditing])

    async function saveCollege() {
        const payload = {
            code: str(collegeCode),
            name: str(collegeName),
            isActive: Boolean(collegeActive),
        }

        if (!payload.code || !payload.name) {
            toast.error("College code and name are required.")
            return
        }

        try {
            if (collegeEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, collegeEditing.$id, payload)
                toast.success("College updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, ID.unique(), payload)
                toast.success("College created.")
            }
            setCollegeOpen(false)
            setCollegeEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save college.")
        }
    }

    // -----------------------------
    // Programs dialog state
    // -----------------------------
    const [programOpen, setProgramOpen] = React.useState(false)
    const [programEditing, setProgramEditing] = React.useState<ProgramDoc | null>(null)

    const [programCollegeId, setProgramCollegeId] = React.useState("")
    const [programCode, setProgramCode] = React.useState("")
    const [programName, setProgramName] = React.useState("")
    const [programDesc, setProgramDesc] = React.useState("")
    const [programActive, setProgramActive] = React.useState(true)

    React.useEffect(() => {
        if (!programOpen) return
        if (!programEditing) {
            setProgramCollegeId(defaultCollegeId)
            setProgramCode("")
            setProgramName("")
            setProgramDesc("")
            setProgramActive(true)
            return
        }

        setProgramCollegeId(programEditing.departmentId)
        setProgramCode(programEditing.code)
        setProgramName(programEditing.name)
        setProgramDesc(String(programEditing.description ?? ""))
        setProgramActive(Boolean(programEditing.isActive))
    }, [programOpen, programEditing, defaultCollegeId])

    async function saveProgram() {
        const payload = {
            departmentId: str(programCollegeId),
            code: str(programCode),
            name: str(programName),
            description: str(programDesc) || null,
            isActive: Boolean(programActive),
        }

        if (!payload.departmentId || !payload.code || !payload.name) {
            toast.error("College, program code, and program name are required.")
            return
        }

        try {
            if (programEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROGRAMS, programEditing.$id, payload)
                toast.success("Program updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.PROGRAMS, ID.unique(), payload)
                toast.success("Program created.")
            }
            setProgramOpen(false)
            setProgramEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save program.")
        }
    }

    // -----------------------------
    // Subjects dialog state
    // -----------------------------
    const [subjectOpen, setSubjectOpen] = React.useState(false)
    const [subjectEditing, setSubjectEditing] = React.useState<SubjectDoc | null>(null)

    const [subjectCollegeId, setSubjectCollegeId] = React.useState("")
    const [subjectProgramIds, setSubjectProgramIds] = React.useState<string[]>([])
    const [subjectYearLevels, setSubjectYearLevels] = React.useState<string[]>([])
    const [subjectSemester, setSubjectSemester] = React.useState("")
    const [subjectTermId, setSubjectTermId] = React.useState("")
    const [subjectCode, setSubjectCode] = React.useState("")
    const [subjectTitle, setSubjectTitle] = React.useState("")
    const [subjectUnits, setSubjectUnits] = React.useState("3")
    const [subjectLec, setSubjectLec] = React.useState("3")
    const [subjectLab, setSubjectLab] = React.useState("0")
    const [subjectActive, setSubjectActive] = React.useState(true)

    const selectedTermSemesterForSubjectDialog = React.useMemo(() => {
        const selectedTerm = terms.find((term) => str(term.$id) === str(selectedTermId))
        return str(selectedTerm?.semester)
    }, [terms, selectedTermId])

    React.useEffect(() => {
        if (!subjectOpen) return
        if (!subjectEditing) {
            setSubjectCollegeId(defaultCollegeId)
            setSubjectProgramIds([])
            setSubjectYearLevels([])
            setSubjectSemester(selectedTermSemesterForSubjectDialog)
            setSubjectTermId(str(selectedTermId))
            setSubjectCode("")
            setSubjectTitle("")
            setSubjectUnits("3")
            setSubjectLec("3")
            setSubjectLab("0")
            setSubjectActive(true)
            return
        }

        const linkedTermId = readFirstStringValue(subjectEditing as any, SUBJECT_TERM_KEYS)
        const linkedTerm = terms.find((term) => str(term.$id) === linkedTermId)

        setSubjectCollegeId(String(subjectEditing.departmentId ?? ""))
        setSubjectProgramIds(resolveSubjectProgramIds(subjectEditing as any))
        setSubjectYearLevels(resolveSubjectYearLevels(subjectEditing as any))
        setSubjectSemester(str(linkedTerm?.semester) || readFirstStringValue(subjectEditing as any, SUBJECT_SEMESTER_KEYS))
        setSubjectTermId(linkedTermId)
        setSubjectCode(subjectEditing.code)
        setSubjectTitle(subjectEditing.title)
        setSubjectUnits(String(subjectEditing.units ?? 0))
        setSubjectLec(String(subjectEditing.lectureHours ?? 0))
        setSubjectLab(String(subjectEditing.labHours ?? 0))
        setSubjectActive(Boolean(subjectEditing.isActive))
    }, [subjectOpen, subjectEditing, defaultCollegeId, programs, selectedTermId, selectedTermSemesterForSubjectDialog, terms])



    const subjectProgramsForSelectedCollege = React.useMemo(() => {
        const collegeId = str(subjectCollegeId)
        if (!collegeId) return []

        return programs
            .filter((program) => str(program.departmentId) === collegeId)
            .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`))
    }, [programs, subjectCollegeId])

    React.useEffect(() => {
        if (!subjectOpen) return

        const validProgramIds = new Set(subjectProgramsForSelectedCollege.map((program) => str(program.$id)))
        setSubjectProgramIds((current) => current.filter((programId) => validProgramIds.has(str(programId))))
    }, [subjectCollegeId, subjectOpen, subjectProgramsForSelectedCollege])

    async function saveSubject() {
        const units = num(subjectUnits, 0)
        const lec = num(subjectLec, 0)
        const lab = num(subjectLab, 0)
        const total = lec + lab
        const termId = str(subjectTermId)
        const collegeId = str(subjectCollegeId)
        const programIds = Array.from(new Set(subjectProgramIds.map((value) => str(value)).filter(Boolean)))
        const primaryProgramId = programIds[0] ?? null
        const yearLevels = Array.from(
            new Set(
                subjectYearLevels
                    .map((value) => extractSectionYearNumber(value) || normalizeSectionYearLevelValue(value))
                    .filter(Boolean)
            )
        )
        const primaryYearLevel = yearLevels[0] ?? ""
        const legacyYearLevel = buildStoredSectionYearLevel(primaryYearLevel, primaryProgramId, programs)
        const yearNumber = extractSectionYearNumber(primaryYearLevel)
        const linkedTermSemester = str(terms.find((term) => str(term.$id) === termId)?.semester)
        const semester = str(subjectSemester) || linkedTermSemester

        const payload: any = {
            code: str(subjectCode),
            title: str(subjectTitle),
            units,
            lectureHours: lec,
            labHours: lab,
            totalHours: total,
            isActive: Boolean(subjectActive),
            ...(subjectEditing
                ? buildSubjectTermPayload(subjectEditing as any, termId)
                : { termId: termId || null }),
            ...(subjectEditing
                ? buildSubjectProgramPayload(subjectEditing as any, primaryProgramId)
                : { programId: primaryProgramId }),
            ...(subjectEditing
                ? buildSubjectProgramIdsPayload(subjectEditing as any, programIds)
                : { programIds }),
            ...(subjectEditing
                ? buildSubjectYearLevelPayload(subjectEditing as any, legacyYearLevel, primaryProgramId, programs)
                : { yearLevel: legacyYearLevel || null }),
            ...(subjectEditing
                ? buildSubjectYearLevelsPayload(subjectEditing as any, yearLevels)
                : { yearLevels }),
            ...(subjectEditing
                ? buildSubjectSemesterPayload(subjectEditing as any, semester)
                : { semester: semester || null }),
        }

        payload.departmentId = collegeId ? collegeId : null

        if (!payload.code || !payload.title) {
            toast.error("Subject code and title are required.")
            return
        }

        if (!collegeId) {
            toast.error("College is required for Subjects.")
            return
        }

        if (programIds.length === 0) {
            toast.error("Select at least one program for Subjects.")
            return
        }

        if (!primaryYearLevel || !yearNumber || !YEAR_LEVEL_OPTIONS.map(String).includes(yearNumber)) {
            toast.error("Select at least one valid year level for Subjects.")
            return
        }

        if (!semester) {
            toast.error("Semester is required for Subjects.")
            return
        }

        try {
            if (subjectEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, subjectEditing.$id, payload)
                toast.success("Subject updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, ID.unique(), payload)
                toast.success("Subject created.")
            }
            setSubjectOpen(false)
            setSubjectEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save subject.")
        }
    }

    async function setSubjectTermLink(subjectIdInput: string, termIdInput?: string | null) {
        const subjectId = str(subjectIdInput)
        const termId = str(termIdInput)

        if (!subjectId) {
            toast.error("Missing subject id.")
            return false
        }

        const currentSubject = subjects.find((subject) => subject.$id === subjectId)
        if (!currentSubject) {
            toast.error("Subject not found.")
            return false
        }

        try {
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SUBJECTS,
                subjectId,
                buildSubjectTermPayload(currentSubject as any, termId)
            )

            await refreshAll()

            if (termId) {
                toast.success(
                    `${currentSubject.code} linked to ${termLabel(terms, termId)}.`
                )
            } else {
                toast.success(`${currentSubject.code} unlinked from academic term.`)
            }

            return true
        } catch (e: any) {
            toast.error(
                e?.message ||
                    (termId
                        ? "Failed to link subject to term."
                        : "Failed to unlink subject from term.")
            )
            return false
        }
    }

    async function bulkLinkSubjectsToTerm(subjectIds: string[], termIdInput: string) {
        const termId = str(termIdInput)
        const normalizedIds = Array.from(new Set(subjectIds.map((id) => str(id)).filter(Boolean)))

        if (!termId) {
            toast.error("Please select a term.")
            return { updated: 0, failed: [] as string[] }
        }

        if (normalizedIds.length === 0) {
            toast.error("Please select at least one subject.")
            return { updated: 0, failed: [] as string[] }
        }

        const subjectById = new Map(subjects.map((subject) => [subject.$id, subject]))
        let updated = 0
        const failed: string[] = []

        for (const subjectId of normalizedIds) {
            try {
                const currentSubject = subjectById.get(subjectId)
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.SUBJECTS,
                    subjectId,
                    buildSubjectTermPayload(currentSubject as any, termId)
                )
                updated += 1
            } catch {
                const subject = subjectById.get(subjectId)
                failed.push(str((subject as any)?.code) || subjectId)
            }
        }

        if (updated > 0) {
            await refreshAll()
        }

        const linkedTermLabel = termLabel(terms, termId)

        if (updated > 0 && failed.length === 0) {
            toast.success(
                `${updated} subject${updated === 1 ? "" : "s"} linked to ${linkedTermLabel}.`
            )
        } else if (updated > 0 && failed.length > 0) {
            toast.error(
                `Linked ${updated} subject${updated === 1 ? "" : "s"} to ${linkedTermLabel}, but failed for: ${failed.join(", ")}`
            )
        } else {
            toast.error("No subjects were linked to term.")
        }

        return { updated, failed }
    }

    // -----------------------------
    // Faculty dialog state
    // -----------------------------
    const [facultyOpen, setFacultyOpen] = React.useState(false)
    const [facultyEditing, setFacultyEditing] = React.useState<FacultyProfileDoc | null>(null)

    const [facultyUserId, setFacultyUserId] = React.useState("")
    const [facultyEmpNo, setFacultyEmpNo] = React.useState("")
    const [facultyCollegeId, setFacultyCollegeId] = React.useState("")
    const [facultyRank, setFacultyRank] = React.useState("")
    const [facultyMaxUnits, setFacultyMaxUnits] = React.useState("")
    const [facultyMaxHours, setFacultyMaxHours] = React.useState("")
    const [facultyNotes, setFacultyNotes] = React.useState("")

    // Optional bulk input for repeated faculty encoding
    const [facBulkCollegeId, setFacBulkCollegeId] = React.useState("")
    const [facBulkText, setFacBulkText] = React.useState("")

    React.useEffect(() => {
        setFacBulkCollegeId((prev) => prev || defaultCollegeId)
    }, [defaultCollegeId])

    React.useEffect(() => {
        if (!facultyOpen) return
        if (!facultyEditing) {
            setFacultyUserId("")
            setFacultyEmpNo("")
            setFacultyCollegeId(defaultCollegeId)
            setFacultyRank("")
            setFacultyMaxUnits("")
            setFacultyMaxHours("")
            setFacultyNotes("")
            return
        }

        setFacultyUserId(facultyEditing.userId)
        setFacultyEmpNo(String(facultyEditing.employeeNo ?? ""))
        setFacultyCollegeId(facultyEditing.departmentId)
        setFacultyRank(String(facultyEditing.rank ?? ""))
        setFacultyMaxUnits(facultyEditing.maxUnits != null ? String(facultyEditing.maxUnits) : "")
        setFacultyMaxHours(facultyEditing.maxHours != null ? String(facultyEditing.maxHours) : "")
        setFacultyNotes(String(facultyEditing.notes ?? ""))
    }, [facultyOpen, facultyEditing, defaultCollegeId])

    const selectedFacultyUser = React.useMemo(() => {
        const id = str(facultyUserId)
        if (!id) return null
        return facultyUserMap.get(id) ?? null
    }, [facultyUserId, facultyUserMap])

    const availableFacultyUsers = React.useMemo(() => {
        const existing = new Set(facultyProfiles.map((f) => str(f.userId)))
        return facultyUsers.filter((u) => {
            if (!u.userId) return false
            if (facultyEditing?.userId && u.userId === facultyEditing.userId) return true
            return !existing.has(u.userId)
        })
    }, [facultyUsers, facultyProfiles, facultyEditing?.userId])

    async function saveFacultyProfile() {
        const payload: any = {
            userId: str(facultyUserId),
            employeeNo: str(facultyEmpNo) || null,
            departmentId: str(facultyCollegeId),
            rank: str(facultyRank) || null,
            maxUnits: str(facultyMaxUnits) ? num(facultyMaxUnits, 0) : null,
            maxHours: str(facultyMaxHours) ? num(facultyMaxHours, 0) : null,
            notes: str(facultyNotes) || null,
        }

        if (!payload.userId || !payload.departmentId) {
            toast.error("Faculty user and college are required for Faculty.")
            return
        }

        try {
            if (facultyEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, facultyEditing.$id, payload)
                toast.success("Faculty updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, ID.unique(), payload)
                toast.success("Faculty created.")
            }
            setFacultyOpen(false)
            setFacultyEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save faculty.")
        }
    }

    async function saveFacultyBulkList() {
        const collegeId = str(facBulkCollegeId) || str(defaultCollegeId)
        if (!collegeId) {
            toast.error("Select a default college first before bulk encoding.")
            return
        }

        const lines = facBulkText
            .split(/\r?\n/)
            .map((x) => x.trim())
            .filter(Boolean)

        if (lines.length === 0) {
            toast.error("Enter at least one faculty row for bulk encode.")
            return
        }

        const knownFacultyUserIds = new Set(facultyUsers.map((u) => str(u.userId)))
        const existing = new Set(facultyProfiles.map((f) => str(f.userId)))

        let created = 0
        let skipped = 0
        let failed = 0

        for (const line of lines) {
            const parts = line.split(",").map((p) => p.trim())
            const userId = str(parts[0])

            if (!userId) {
                skipped += 1
                continue
            }

            if (!knownFacultyUserIds.has(userId)) {
                skipped += 1
                continue
            }

            if (existing.has(userId)) {
                skipped += 1
                continue
            }

            const employeeNo = str(parts[1]) || null
            const rank = str(parts[2]) || null
            const maxUnits = str(parts[3]) ? num(parts[3], 0) : null
            const maxHours = str(parts[4]) ? num(parts[4], 0) : null
            const notes = parts.length > 5 ? str(parts.slice(5).join(",")) || null : null

            try {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, ID.unique(), {
                    userId,
                    employeeNo,
                    departmentId: collegeId,
                    rank,
                    maxUnits,
                    maxHours,
                    notes,
                })
                existing.add(userId)
                created += 1
            } catch {
                failed += 1
            }
        }

        await refreshAll()

        if (failed > 0) {
            toast.error(`Bulk encode finished. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`)
            return
        }

        toast.success(`Bulk encode finished. Created: ${created}, Skipped: ${skipped}`)
        if (created > 0) setFacBulkText("")
    }

    // -----------------------------
    // Sections dialog state
    // -----------------------------
    const [sectionOpen, setSectionOpen] = React.useState(false)
    const [sectionEditing, setSectionEditing] = React.useState<SectionDoc | null>(null)

    const [sectionTermId, setSectionTermId] = React.useState("")
    const [sectionCollegeId, setSectionCollegeId] = React.useState("")
    const [sectionProgramId, setSectionProgramId] = React.useState<string>("__none__")
    const [sectionYear, setSectionYear] = React.useState<string>("1")
    const [sectionName, setSectionName] = React.useState<string>(SECTION_NAME_OPTIONS[0] || "A")
    const [sectionStudentCount, setSectionStudentCount] = React.useState<string>("")
    const [sectionActive, setSectionActive] = React.useState<boolean>(true)

    React.useEffect(() => {
        if (!sectionOpen) return

        if (!sectionEditing) {
            setSectionTermId(str(selectedTermId))
            setSectionCollegeId(defaultCollegeId)
            setSectionProgramId("__none__")
            setSectionYear("1")
            setSectionName(SECTION_NAME_OPTIONS[0] || "A")
            setSectionStudentCount("")
            setSectionActive(true)
            return
        }

        setSectionTermId(str(sectionEditing.termId))
        setSectionCollegeId(str(sectionEditing.departmentId))
        setSectionProgramId(sectionEditing.programId ? str(sectionEditing.programId) : "__none__")
        setSectionYear(normalizeSectionYearLevelValue(sectionEditing.yearLevel) || "1")
        setSectionName(normalizeSectionNameValue(sectionEditing.name) || (SECTION_NAME_OPTIONS[0] || "A"))
        setSectionStudentCount(sectionEditing.studentCount != null ? String(sectionEditing.studentCount) : "")
        setSectionActive(Boolean(sectionEditing.isActive))
    }, [sectionOpen, sectionEditing, selectedTermId, defaultCollegeId])

    const programsForSelectedCollege = React.useMemo(() => {
        const collegeId = str(sectionCollegeId)
        if (!collegeId) return []
        return programs
            .filter((p) => str(p.departmentId) === collegeId)
            .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`))
    }, [programs, sectionCollegeId])

    async function saveSection() {
        const termId = str(sectionTermId)
        const departmentId = str(sectionCollegeId)
        const programId = str(sectionProgramId) === "__none__" ? null : str(sectionProgramId)
        const yearLevel = buildStoredSectionYearLevel(sectionYear, programId, programs)
        const yearNumber = extractSectionYearNumber(yearLevel)
        const name = normalizeSectionNameValue(sectionName)

        if (!termId) {
            toast.error("Academic term is required for Sections.")
            return
        }
        if (!departmentId) {
            toast.error("College is required for Sections.")
            return
        }
        if (!yearLevel || !yearNumber || !YEAR_LEVEL_OPTIONS.map(String).includes(yearNumber)) {
            toast.error("Year level must be valid.")
            return
        }
        if (!name) {
            toast.error("Section name is required.")
            return
        }
        if (!SECTION_NAME_OPTIONS.includes(name as any)) {
            toast.error(`Invalid section name. Use A-Z or "Others".`)
            return
        }

        const studentCount = str(sectionStudentCount) ? num(sectionStudentCount, 0) : null
        const editingSectionId = sectionEditing?.$id ?? null

        const payload: any = {
            termId,
            departmentId,
            programId,
            yearLevel,
            name,
            studentCount,
            isActive: Boolean(sectionActive),
        }

        try {
            const duplicateResult = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SECTIONS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("yearLevel", yearLevel),
                    Query.equal("name", name),
                    Query.limit(100),
                ]
            )

            const conflictingSection = (duplicateResult?.documents ?? []).find(
                (doc: any) => String(doc?.$id ?? "") !== String(editingSectionId ?? "")
            )

            if (conflictingSection) {
                toast.error("Section already exists for this term/college/year/name.")
                return
            }

            if (sectionEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, sectionEditing.$id, payload)
                toast.success("Section updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.SECTIONS, ID.unique(), payload)
                toast.success("Section created.")
            }

            setSectionOpen(false)
            setSectionEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save section.")
        }
    }

    // -----------------------------
    // Delete confirm
    // -----------------------------
    async function confirmDelete() {
        if (!deleteIntent) return

        try {
            if (deleteIntent.type === "college") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, deleteIntent.doc.$id)
                toast.success("College deleted.")
            }

            if (deleteIntent.type === "program") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PROGRAMS, deleteIntent.doc.$id)
                toast.success("Program deleted.")
            }

            if (deleteIntent.type === "subject") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, deleteIntent.doc.$id)
                toast.success("Subject deleted.")
            }

            if (deleteIntent.type === "subjects") {
                const subjectDocs = deleteIntent.docs.filter((doc) => str(doc?.$id))

                if (subjectDocs.length === 0) {
                    setDeleteIntent(null)
                    toast.error("No subjects available for deletion.")
                    return
                }

                let deleted = 0
                const failedLabels: string[] = []

                for (const subject of subjectDocs) {
                    try {
                        await databases.deleteDocument(
                            DATABASE_ID,
                            COLLECTIONS.SUBJECTS,
                            subject.$id
                        )
                        deleted += 1
                    } catch {
                        failedLabels.push(`${subject.code} — ${subject.title}`)
                    }
                }

                setDeleteIntent(null)
                await refreshAll()

                if (deleted === subjectDocs.length) {
                    toast.success(
                        `${deleted} subject${deleted === 1 ? "" : "s"} deleted.`
                    )
                    return
                }

                if (deleted > 0) {
                    const failedPreview = failedLabels.slice(0, 3).join(", ")
                    const failedSuffix =
                        failedLabels.length > 3 ? ", and more" : ""

                    toast.error(
                        `Deleted ${deleted} subject${deleted === 1 ? "" : "s"}, but failed for ${failedLabels.length}: ${failedPreview}${failedSuffix}.`
                    )
                    return
                }

                toast.error("Failed to delete the selected subjects.")
                return
            }

            if (deleteIntent.type === "faculty") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, deleteIntent.doc.$id)
                toast.success("Faculty deleted.")
            }

            if (deleteIntent.type === "section") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SECTIONS, deleteIntent.doc.$id)
                toast.success("Section deleted.")
            }

            setDeleteIntent(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete record.")
        }
    }

    // -----------------------------
    // Search + filtered lists
    // -----------------------------
    const q = search.trim().toLowerCase()

    const filteredColleges = React.useMemo(() => {
        if (!q) return colleges
        return colleges.filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(q))
    }, [colleges, q])

    const filteredPrograms = React.useMemo(() => {
        if (!q) return programs
        return programs.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q))
    }, [programs, q])

    const filteredSubjects = React.useMemo(() => {
        if (!q) return subjects
        return subjects.filter((s: any) => {
            const linkedTermText = readFirstStringValue(s, SUBJECT_TERM_KEYS)
            const subjectProgramText = resolveSubjectProgramIds(s)
                .map((programId) => programLabel(programs, programId || null))
                .join(" ")
            const subjectYearLevelText = resolveSubjectYearLevels(s).join(" ")
            const subjectSemesterText = readFirstStringValue(s, SUBJECT_SEMESTER_KEYS)
            return `${s.code} ${s.title} ${linkedTermText} ${subjectProgramText} ${subjectYearLevelText} ${subjectSemesterText}`.toLowerCase().includes(q)
        })
    }, [subjects, q, programs])

    const filteredFaculty = React.useMemo(() => {
        if (!q) return facultyProfiles
        return facultyProfiles.filter((f) => {
            const u = facultyUserMap.get(str(f.userId))
            const nameEmail = u ? `${facultyDisplay(u)} ${u.userId}` : ""
            return `${f.userId} ${f.employeeNo ?? ""} ${f.rank ?? ""} ${nameEmail}`.toLowerCase().includes(q)
        })
    }, [facultyProfiles, q, facultyUserMap])

    const visibleSectionsByTerm = React.useMemo(() => {
        const termId = str(selectedTermId)
        if (!termId) return sections
        return sections.filter((s) => str(s.termId) === termId)
    }, [sections, selectedTermId])

    const filteredSections = React.useMemo(() => {
        const base = visibleSectionsByTerm
        if (!q) return base
        return base.filter((s) => {
            const college = collegeLabel(colleges, s.departmentId)
            const prog = programLabel(programs, s.programId ?? null)
            const term = termLabel(terms, s.termId)
            const main = buildSectionDisplayLabel(s.yearLevel, s.name)
            return `${main} ${college} ${prog} ${term} ${s.studentCount ?? ""}`
                .toLowerCase()
                .includes(q)
        })
    }, [visibleSectionsByTerm, q, colleges, programs, terms])

    const stats = React.useMemo(
        () => [
            { label: "Colleges", value: colleges.length },
            { label: "Programs/Courses", value: programs.length },
            { label: "Subjects", value: subjects.length },
            { label: "Faculty", value: facultyProfiles.length },
            { label: "Sections", value: sections.length },
        ],
        [colleges.length, programs.length, subjects.length, facultyProfiles.length, sections.length]
    )

    // -----------------------------
    // List of Records + conflict detection (room/day/time only)
    // -----------------------------
    const [recordSubjectFilter, setRecordSubjectFilter] = React.useState("__all__")
    const [recordUnitFilter, setRecordUnitFilter] = React.useState("__all__")

    const recordRows = React.useMemo<ListRecordRow[]>(() => {
        return classMeetings.map((meeting) => {
            const cls = classMap.get(str(meeting.classId))
            const room = meeting.roomId ? roomMap.get(str(meeting.roomId)) : undefined
            const subject = cls?.subjectId ? subjectMap.get(str(cls.subjectId)) : undefined
            const faculty = cls?.facultyUserId ? facultyUserMap.get(str(cls.facultyUserId)) : undefined
            const section = cls?.sectionId ? sectionMap.get(str(cls.sectionId)) : undefined
            const sectionProgramId = section?.programId ? str(section.programId) : cls?.programId ? str(cls.programId) : null
            const sectionYearLevel = section?.yearLevel ? normalizeSectionYearLevelValue(section.yearLevel) : null

            return {
                id: meeting.$id,
                termId: str(cls?.termId),
                termLabel: termLabel(terms, cls?.termId ?? null),
                dayOfWeek: str(meeting.dayOfWeek) || "—",
                startTime: str(meeting.startTime) || "—",
                endTime: str(meeting.endTime) || "—",
                roomId: meeting.roomId ? str(meeting.roomId) : null,
                roomLabel: room ? `${str(room.code)}${str(room.name) ? ` — ${str(room.name)}` : ""}` : "TBA Room",
                facultyUserId: cls?.facultyUserId ? str(cls?.facultyUserId) : null,
                facultyLabel: faculty ? facultyDisplay(faculty) : "TBA Faculty",
                subjectId: cls?.subjectId ? str(cls.subjectId) : null,
                subjectCode: str(subject?.code) || "TBA",
                subjectTitle: str(subject?.title) || "Unknown Subject",
                units: subject?.units ?? null,
                classCode: str(cls?.classCode) || "—",
                collegeLabel: collegeLabel(colleges, cls?.departmentId ?? section?.departmentId ?? null),
                programLabel: programLabel(programs, sectionProgramId),
                sectionId: cls?.sectionId ? str(cls.sectionId) : null,
                sectionProgramId,
                sectionYearLevel,
                sectionLabel: section
                    ? buildSectionDisplayLabel(section.yearLevel, section.name)
                    : str(cls?.sectionId) || "—",
            }
        })
    }, [classMeetings, classMap, roomMap, subjectMap, facultyUserMap, terms, colleges, programs, sectionMap])

    const conflictRecordIds = React.useMemo(() => {
        const marked = new Set<string>()
        const groups = new Map<string, ListRecordRow[]>()

        for (const r of recordRows) {
            const roomId = str(r.roomId)
            const day = str(r.dayOfWeek).toUpperCase()
            if (!roomId || !day) continue

            const key = `${str(r.termId)}|${day}|${roomId}`
            const list = groups.get(key) ?? []
            list.push(r)
            groups.set(key, list)
        }

        for (const list of groups.values()) {
            const sorted = [...list].sort((a, b) => {
                const sa = num(a.startTime.replace(":", ""), 0)
                const sb = num(b.startTime.replace(":", ""), 0)
                return sa - sb
            })

            for (let i = 0; i < sorted.length; i += 1) {
                for (let j = i + 1; j < sorted.length; j += 1) {
                    const a = sorted[i]
                    const b = sorted[j]

                    if (isTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                        marked.add(a.id)
                        marked.add(b.id)
                    }
                }
            }
        }

        return marked
    }, [recordRows])

    const recordUnitOptions = React.useMemo(() => {
        const unique = Array.from(
            new Set(subjects.map((s) => num(s.units, 0)).filter((u) => u > 0))
        ) as number[]
        return unique.sort((a, b) => a - b)
    }, [subjects])

    const filteredRecordRows = React.useMemo(() => {
        const subjectId = recordSubjectFilter === "__all__" ? "" : str(recordSubjectFilter)
        const unitValue = recordUnitFilter === "__all__" ? null : num(recordUnitFilter, NaN)

        return recordRows.filter((r) => {
            if (subjectId && str(r.subjectId) !== subjectId) return false
            if (unitValue != null && Number.isFinite(unitValue) && num(r.units, -1) !== unitValue) return false

            if (!q) return true

            const hay = `${r.termLabel} ${r.dayOfWeek} ${r.startTime} ${r.endTime} ${r.roomLabel} ${r.facultyLabel} ${r.subjectCode} ${r.subjectTitle} ${r.classCode} ${r.collegeLabel} ${r.programLabel}`.toLowerCase()
            return hay.includes(q)
        })
    }, [recordRows, q, recordSubjectFilter, recordUnitFilter])

    const bulkDeleteSubjectPreview =
        deleteIntent?.type === "subjects"
            ? deleteIntent.docs
                  .slice(0, 3)
                  .map((subject) => `"${subject.code} — ${subject.title}"`)
                  .join(", ")
            : ""

    const deleteTitle =
        deleteIntent?.type === "college"
            ? "Delete College"
            : deleteIntent?.type === "program"
                ? "Delete Program"
                : deleteIntent?.type === "subject"
                    ? "Delete Subject"
                    : deleteIntent?.type === "subjects"
                        ? deleteIntent.scope === "visible"
                            ? "Delete All Visible Subjects"
                            : "Delete Selected Subjects"
                        : deleteIntent?.type === "faculty"
                            ? "Delete Faculty"
                            : deleteIntent?.type === "section"
                                ? "Delete Section"
                                : "Delete"

    const deleteText =
        deleteIntent?.type === "college"
            ? `This will permanently delete "${deleteIntent.doc.code} — ${deleteIntent.doc.name}".`
            : deleteIntent?.type === "program"
                ? `This will permanently delete "${deleteIntent.doc.code} — ${deleteIntent.doc.name}".`
                : deleteIntent?.type === "subject"
                    ? `This will permanently delete "${deleteIntent.doc.code} — ${deleteIntent.doc.title}".`
                    : deleteIntent?.type === "subjects"
                        ? `This will permanently delete ${deleteIntent.docs.length} subject${deleteIntent.docs.length === 1 ? "" : "s"} from the current ${deleteIntent.scope === "visible" ? "visible list" : "selection"}${bulkDeleteSubjectPreview ? `, including ${bulkDeleteSubjectPreview}${deleteIntent.docs.length > 3 ? ", and more" : ""}` : ""}.`
                        : deleteIntent?.type === "faculty"
                            ? `This will permanently delete faculty for userId "${deleteIntent.doc.userId}".`
                            : deleteIntent?.type === "section"
                                ? `This will permanently delete section "${buildSectionDisplayLabel(deleteIntent.doc.yearLevel, deleteIntent.doc.name)}".`
                                : "This action cannot be undone."

    const deleteActionLabel =
        deleteIntent?.type === "subjects"
            ? deleteIntent.scope === "visible"
                ? "Delete All Visible"
                : "Delete Selected"
            : deleteIntent?.type === "subject"
                ? "Delete Subject"
                : deleteIntent?.type === "college"
                    ? "Delete College"
                    : deleteIntent?.type === "program"
                        ? "Delete Program"
                        : deleteIntent?.type === "faculty"
                            ? "Delete Faculty"
                            : deleteIntent?.type === "section"
                                ? "Delete Section"
                                : "Delete"

    return {
        // main
        tab,
        setTab,
        loading,
        search,
        setSearch,
        refreshAll,

        // data
        colleges,
        programs,
        subjects,
        facultyProfiles,
        facultyUsers,
        terms,
        sections,
        rooms,
        classes,
        classMeetings,

        // maps
        facultyUserMap,

        // labels/options
        defaultCollegeId,
        stats,
        selectedTermId,
        setSelectedTermId,

        // filtered lists
        filteredColleges,
        filteredPrograms,
        filteredSubjects,
        filteredFaculty,
        filteredSections,

        // colleges dialog
        collegeOpen,
        setCollegeOpen,
        collegeEditing,
        setCollegeEditing,
        collegeCode,
        setCollegeCode,
        collegeName,
        setCollegeName,
        collegeActive,
        setCollegeActive,
        saveCollege,

        // programs dialog
        programOpen,
        setProgramOpen,
        programEditing,
        setProgramEditing,
        programCollegeId,
        setProgramCollegeId,
        programCode,
        setProgramCode,
        programName,
        setProgramName,
        programDesc,
        setProgramDesc,
        programActive,
        setProgramActive,
        saveProgram,

        // subjects dialog
        subjectOpen,
        setSubjectOpen,
        subjectEditing,
        setSubjectEditing,
        subjectCollegeId,
        setSubjectCollegeId,
        subjectProgramIds,
        setSubjectProgramIds,
        subjectYearLevels,
        setSubjectYearLevels,
        subjectSemester,
        setSubjectSemester,
        subjectProgramsForSelectedCollege,
        subjectTermId,
        setSubjectTermId,
        subjectCode,
        setSubjectCode,
        subjectTitle,
        setSubjectTitle,
        subjectUnits,
        setSubjectUnits,
        subjectLec,
        setSubjectLec,
        subjectLab,
        setSubjectLab,
        subjectActive,
        setSubjectActive,
        saveSubject,
        setSubjectTermLink,
        bulkLinkSubjectsToTerm,

        // faculty dialog
        facultyOpen,
        setFacultyOpen,
        facultyEditing,
        setFacultyEditing,
        facultyUserId,
        setFacultyUserId,
        facultyEmpNo,
        setFacultyEmpNo,
        facultyCollegeId,
        setFacultyCollegeId,
        facultyRank,
        setFacultyRank,
        facultyMaxUnits,
        setFacultyMaxUnits,
        facultyMaxHours,
        setFacultyMaxHours,
        facultyNotes,
        setFacultyNotes,
        selectedFacultyUser,
        availableFacultyUsers,
        saveFacultyProfile,

        // optional bulk encode faculty
        facBulkCollegeId,
        setFacBulkCollegeId,
        facBulkText,
        setFacBulkText,
        saveFacultyBulkList,

        // sections dialog
        sectionOpen,
        setSectionOpen,
        sectionEditing,
        setSectionEditing,
        sectionTermId,
        setSectionTermId,
        sectionCollegeId,
        setSectionCollegeId,
        sectionProgramId,
        setSectionProgramId,
        sectionYear,
        setSectionYear,
        sectionName,
        setSectionName,
        sectionStudentCount,
        setSectionStudentCount,
        sectionActive,
        setSectionActive,
        programsForSelectedCollege,
        saveSection,

        // delete
        deleteIntent,
        setDeleteIntent,
        deleteTitle,
        deleteText,
        deleteActionLabel,
        confirmDelete,

        // list of records
        recordSubjectFilter,
        setRecordSubjectFilter,
        recordUnitFilter,
        setRecordUnitFilter,
        recordUnitOptions,
        filteredRecordRows,
        conflictRecordIds,

        // helpers
        collegeLabel,
        programLabel,
        termLabel,
        facultyDisplay,
    }
}

export type MasterDataManagementVM = ReturnType<typeof useMasterDataManagement>