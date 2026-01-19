/* eslint-disable @typescript-eslint/no-explicit-any */

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

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

export type AcademicTermLite = {
    $id: string
    schoolYear: string
    semester: string
    startDate: string
    endDate: string
    isActive: boolean
    isLocked: boolean
}

export type SectionRecord = {
    $id: string
    termId: string
    departmentId: string
    programId?: string | null
    yearLevel: number
    name: string
    studentCount?: number | null
    isActive: boolean
}

export async function listAcademicTermsLite() {
    const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, [
        Query.orderDesc("startDate"),
        Query.limit(200),
    ])

    return (res?.documents ?? []).map((t: any) => ({
        $id: t.$id,
        schoolYear: str(t.schoolYear),
        semester: str(t.semester),
        startDate: str(t.startDate),
        endDate: str(t.endDate),
        isActive: toBool(t.isActive),
        isLocked: toBool(t.isLocked),
    })) as AcademicTermLite[]
}

export async function listSections(params?: {
    termId?: string
    departmentId?: string
    limit?: number
}) {
    const queries: any[] = [
        Query.orderAsc("yearLevel"),
        Query.orderAsc("name"),
        Query.limit(params?.limit ?? 2000),
    ]

    const termId = str(params?.termId)
    const deptId = str(params?.departmentId)

    if (termId) queries.push(Query.equal("termId", termId))
    if (deptId) queries.push(Query.equal("departmentId", deptId))

    const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SECTIONS, queries)

    return (res?.documents ?? []).map((s: any) => ({
        $id: s.$id,
        termId: str(s.termId),
        departmentId: str(s.departmentId),
        programId: s.programId ? str(s.programId) : null,
        yearLevel: num(s.yearLevel, 1),
        name: str(s.name),
        studentCount: s.studentCount != null ? num(s.studentCount, 0) : null,
        isActive: toBool(s.isActive),
    })) as SectionRecord[]
}

export async function createSection(payload: Omit<SectionRecord, "$id">) {
    const doc: any = {
        termId: str(payload.termId),
        departmentId: str(payload.departmentId),
        programId: payload.programId ? str(payload.programId) : null,
        yearLevel: num(payload.yearLevel, 1),
        name: str(payload.name),
        studentCount: payload.studentCount != null ? num(payload.studentCount, 0) : null,
        isActive: Boolean(payload.isActive),
    }

    return databases.createDocument(DATABASE_ID, COLLECTIONS.SECTIONS, ID.unique(), doc)
}

export async function updateSection(sectionId: string, payload: Partial<Omit<SectionRecord, "$id">>) {
    const doc: any = {
        ...(payload.termId != null ? { termId: str(payload.termId) } : {}),
        ...(payload.departmentId != null ? { departmentId: str(payload.departmentId) } : {}),
        ...(payload.programId !== undefined ? { programId: payload.programId ? str(payload.programId) : null } : {}),
        ...(payload.yearLevel != null ? { yearLevel: num(payload.yearLevel, 1) } : {}),
        ...(payload.name != null ? { name: str(payload.name) } : {}),
        ...(payload.studentCount !== undefined
            ? { studentCount: payload.studentCount != null ? num(payload.studentCount, 0) : null }
            : {}),
        ...(payload.isActive != null ? { isActive: Boolean(payload.isActive) } : {}),
    }

    return databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, sectionId, doc)
}

export async function deleteSection(sectionId: string) {
    return databases.deleteDocument(DATABASE_ID, COLLECTIONS.SECTIONS, sectionId)
}
