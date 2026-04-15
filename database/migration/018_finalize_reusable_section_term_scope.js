import { Client, Databases, Query } from "node-appwrite"

const MIGRATION_ID = "018_finalize_reusable_section_term_scope"
const SECTIONS_COLLECTION_ID = "sections"
const CLASSES_COLLECTION_ID = "classes"
const PAGE_LIMIT = 100
const LEGACY_SECTION_FIELDS = ["termId", "semester", "academicTermLabel"]

function getEnvValue(...keys) {
    for (const key of keys) {
        const value = String(process.env[key] || "").trim()
        if (value) return value
    }

    return ""
}

function createFallbackDatabases() {
    const endpoint = getEnvValue("APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_ENDPOINT")
    const projectId = getEnvValue("APPWRITE_PROJECT_ID", "NEXT_PUBLIC_APPWRITE_PROJECT_ID")
    const apiKey = getEnvValue("APPWRITE_API_KEY")

    if (!endpoint || !projectId || !apiKey) {
        throw new Error(
            "Missing Appwrite migration credentials. Provide a databases client through the migration runner or set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY."
        )
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
    return new Databases(client)
}

function resolveDatabaseId(databaseId) {
    return (
        String(databaseId || "").trim() ||
        getEnvValue("APPWRITE_DATABASE_ID", "NEXT_PUBLIC_APPWRITE_DATABASE_ID", "DATABASE_ID")
    )
}

function str(value) {
    return String(value ?? "").trim()
}

function uniqueStrings(values) {
    return Array.from(new Set(values.map((value) => str(value)).filter(Boolean)))
}

function normalizeYearLevel(value) {
    return str(value).toUpperCase().replace(/\s+/g, " ")
}

function normalizeName(value) {
    return str(value).toUpperCase()
}

function resolveSectionSubjectIds(section) {
    const values = Array.isArray(section?.subjectIds)
        ? section.subjectIds
        : typeof section?.subjectIds === "string"
            ? section.subjectIds.split(",")
            : []

    const normalized = uniqueStrings(values)
    if (normalized.length > 0) return normalized

    const fallback = str(section?.subjectId)
    return fallback ? [fallback] : []
}

function getCanonicalRecord(records) {
    return records
        .slice()
        .sort((left, right) => {
            const leftTime = Date.parse(str(left?.$createdAt)) || 0
            const rightTime = Date.parse(str(right?.$createdAt)) || 0
            if (leftTime !== rightTime) return leftTime - rightTime
            return str(left?.$id).localeCompare(str(right?.$id))
        })[0]
}

function getBestStudentCount(sections) {
    const counts = sections
        .map((section) => (section?.studentCount == null ? null : Number(section.studentCount)))
        .filter((value) => Number.isFinite(value))

    if (counts.length === 0) return null
    return Math.max(...counts)
}

function buildGroupKey(section) {
    return [
        str(section?.departmentId),
        str(section?.programId),
        normalizeYearLevel(section?.yearLevel),
        normalizeName(section?.name),
    ].join("::")
}

async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

async function listAllDocuments(databases, databaseId, collectionId) {
    const documents = []
    let cursorAfter = null

    while (true) {
        const queries = [Query.limit(PAGE_LIMIT)]
        if (cursorAfter) {
            queries.push(Query.cursorAfter(cursorAfter))
        }

        const response = await databases.listDocuments(databaseId, collectionId, queries)
        const page = Array.isArray(response?.documents) ? response.documents : []
        documents.push(...page)

        if (page.length < PAGE_LIMIT) {
            return documents
        }

        cursorAfter = str(page[page.length - 1]?.$id)
        if (!cursorAfter) {
            return documents
        }

        await wait(100)
    }
}

async function listLegacySectionFields(databases, databaseId) {
    try {
        const response = await databases.listAttributes(databaseId, SECTIONS_COLLECTION_ID)
        const attributes = Array.isArray(response?.attributes) ? response.attributes : []
        const keys = new Set(attributes.map((attribute) => str(attribute?.key)))
        return LEGACY_SECTION_FIELDS.filter((key) => keys.has(key))
    } catch {
        return []
    }
}

function buildSectionUpdatePayload(sections, canonical, legacyFields) {
    const mergedSubjectIds = uniqueStrings(sections.flatMap((section) => resolveSectionSubjectIds(section)))
    const mergedProgramId = uniqueStrings(sections.map((section) => section?.programId))[0] || null
    const payload = {
        departmentId: str(canonical?.departmentId || sections[0]?.departmentId),
        programId: mergedProgramId,
        subjectId: mergedSubjectIds[0] || null,
        subjectIds: mergedSubjectIds,
        yearLevel: normalizeYearLevel(canonical?.yearLevel || sections[0]?.yearLevel),
        name: normalizeName(canonical?.name || sections[0]?.name),
        studentCount: getBestStudentCount(sections),
        isActive: sections.some((section) => Boolean(section?.isActive)),
    }

    for (const key of legacyFields) {
        payload[key] = null
    }

    return payload
}

export const id = MIGRATION_ID
export const name = "Finalize reusable section term scope"

export async function up(context = {}) {
    const databases = context.databases || createFallbackDatabases()
    const databaseId = resolveDatabaseId(context.databaseId)
    const log = context.log || console

    if (!databaseId) {
        throw new Error("Missing databaseId for migration 018_finalize_reusable_section_term_scope.")
    }

    const [sections, classes, legacyFields] = await Promise.all([
        listAllDocuments(databases, databaseId, SECTIONS_COLLECTION_ID),
        listAllDocuments(databases, databaseId, CLASSES_COLLECTION_ID),
        listLegacySectionFields(databases, databaseId),
    ])

    const groupedSections = new Map()
    for (const section of sections) {
        const key = buildGroupKey(section)
        const current = groupedSections.get(key) || []
        current.push(section)
        groupedSections.set(key, current)
    }

    let normalizedGroups = 0
    let mergedGroups = 0
    let removedDuplicates = 0
    let rewiredClasses = 0
    let clearedLegacyScope = 0

    for (const group of groupedSections.values()) {
        const canonical = getCanonicalRecord(group)
        const duplicates = group.filter((section) => str(section?.$id) !== str(canonical?.$id))
        const shouldClearLegacyScope =
            legacyFields.length > 0 && LEGACY_SECTION_FIELDS.some((key) => str(canonical?.[key]))

        if (duplicates.length === 0 && !shouldClearLegacyScope) {
            continue
        }

        const payload = buildSectionUpdatePayload(group, canonical, legacyFields)
        await databases.updateDocument(databaseId, SECTIONS_COLLECTION_ID, canonical.$id, payload)
        normalizedGroups += 1

        if (shouldClearLegacyScope) {
            clearedLegacyScope += 1
        }

        for (const duplicate of duplicates) {
            for (const classDoc of classes) {
                if (str(classDoc?.sectionId) !== str(duplicate?.$id)) continue

                await databases.updateDocument(databaseId, CLASSES_COLLECTION_ID, classDoc.$id, {
                    sectionId: canonical.$id,
                })
                rewiredClasses += 1
            }

            await databases.deleteDocument(databaseId, SECTIONS_COLLECTION_ID, duplicate.$id)
            removedDuplicates += 1
        }

        if (duplicates.length > 0) {
            mergedGroups += 1
        }
    }

    log.info?.(
        `✅ ${MIGRATION_ID}: normalized ${normalizedGroups} section group(s), merged ${mergedGroups} duplicate group(s), removed ${removedDuplicates} duplicate section(s), rewired ${rewiredClasses} class reference(s), and cleared legacy term scope on ${clearedLegacyScope} canonical section(s).`
    )
}

export default {
    id,
    name,
    up,
}