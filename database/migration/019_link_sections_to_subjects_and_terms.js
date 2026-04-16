import { Client, Databases, Query } from "node-appwrite"

const MIGRATION_ID = "019_link_sections_to_subjects_and_terms"
const SECTIONS_COLLECTION_ID = "sections"
const SUBJECTS_COLLECTION_ID = "subjects"
const TERMS_COLLECTION_ID = "academic_terms"
const PAGE_LIMIT = 100

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

function extractSectionYearNumber(value) {
    const normalized = normalizeYearLevel(value)
    if (!normalized) return ""

    const prefixed = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/)
    if (prefixed) return prefixed[1]

    const direct = normalized.match(/^([1-9]\d*)$/)
    if (direct) return direct[1]

    const trailing = normalized.match(/([1-9]\d*)$/)
    return trailing?.[1] ?? ""
}

function resolveStringArray(value) {
    if (Array.isArray(value)) {
        return uniqueStrings(value)
    }

    if (typeof value === "string") {
        return uniqueStrings(value.split(","))
    }

    return []
}

function resolveSectionSubjectIds(section) {
    const values = resolveStringArray(section?.subjectIds)
    if (values.length > 0) return values

    const fallback = str(section?.subjectId)
    return fallback ? [fallback] : []
}

function resolveSubjectProgramIds(subject) {
    const values = resolveStringArray(subject?.programIds)
    if (values.length > 0) return values

    const fallback = str(subject?.programId)
    return fallback ? [fallback] : []
}

function resolveSubjectYearLevels(subject) {
    const values = Array.isArray(subject?.yearLevels)
        ? subject.yearLevels
        : typeof subject?.yearLevels === "string"
            ? subject.yearLevels.split(",")
            : []

    const normalized = uniqueStrings(values.map((value) => extractSectionYearNumber(value) || normalizeYearLevel(value)))
    if (normalized.length > 0) return normalized

    const fallback = extractSectionYearNumber(subject?.yearLevel) || normalizeYearLevel(subject?.yearLevel)
    return fallback ? [fallback] : []
}

function resolveSubjectSectionIds(subject) {
    return uniqueStrings([
        ...resolveStringArray(subject?.sectionIds),
        str(subject?.sectionId),
    ])
}

function resolveSubjectLinkedSectionIds(subject) {
    return uniqueStrings([
        ...resolveStringArray(subject?.linkedSectionIds),
        str(subject?.linkedSectionId),
    ])
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function safeCall(fn, { onExists = "skip", onNotFound = "skip", label = "" } = {}) {
    try {
        return await fn()
    } catch (err) {
        if (err?.code === 409 && onExists === "skip") return null
        if (err?.code === 404 && onNotFound === "skip") return null

        console.error(`❌ Failed: ${label}`)
        console.error(err)
        throw err
    }
}

async function callDb(databases, methodName, paramsObject, paramsPositional = []) {
    const fn = databases?.[methodName]
    if (typeof fn !== "function") {
        throw new Error(`Databases SDK method not found: databases.${methodName}()`)
    }

    if (fn.length <= 1) {
        try {
            return await fn.call(databases, paramsObject)
        } catch {
            // fall back to positional signature
        }
    }

    return await fn.call(databases, ...paramsPositional)
}

async function tryGet(fn) {
    try {
        return await fn()
    } catch (err) {
        if (err?.code === 404) return null
        return null
    }
}

async function waitUntil(
    checkFn,
    { label, timeoutMs = 120000, startDelayMs = 200, maxDelayMs = 2000 } = {}
) {
    const started = Date.now()
    let sleep = startDelayMs
    let lastErr = null

    while (true) {
        try {
            const res = await checkFn()
            if (res) return res
        } catch (err) {
            lastErr = err
        }

        if (Date.now() - started > timeoutMs) {
            const lastMsg =
                lastErr?.message ||
                lastErr?.response ||
                (typeof lastErr === "string" ? lastErr : JSON.stringify(lastErr || {}))
            throw new Error(`Timeout while waiting for ${label}. Last error: ${lastMsg}`)
        }

        await delay(sleep)
        sleep = Math.min(Math.floor(sleep * 1.35), maxDelayMs)
    }
}

async function waitForCollection(databases, databaseId, collectionId) {
    return await waitUntil(
        async () => {
            const col = await tryGet(() =>
                callDb(databases, "getCollection", { databaseId, collectionId }, [databaseId, collectionId])
            )
            return !!col
        },
        { label: `collection ${collectionId}` }
    )
}

async function waitForAttributeAvailable(databases, databaseId, collectionId, key) {
    return await waitUntil(
        async () => {
            const attr = await tryGet(() =>
                callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
            )
            if (!attr) return false

            const status = str(attr?.status).toLowerCase()
            if (status === "available") return true

            if ((status === "failed" || status === "stuck") && attr?.error) {
                throw new Error(`Attribute ${collectionId}.${key} status=${attr.status} error=${attr.error}`)
            }

            return false
        },
        { label: `attribute ${collectionId}.${key}` }
    )
}

async function waitForIndexAvailable(databases, databaseId, collectionId, key) {
    return await waitUntil(
        async () => {
            const idx = await tryGet(() =>
                callDb(databases, "getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
            )
            if (!idx) return false

            const status = str(idx?.status).toLowerCase()
            if (status === "available") return true

            if ((status === "failed" || status === "stuck") && idx?.error) {
                throw new Error(`Index ${collectionId}.${key} status=${idx.status} error=${idx.error}`)
            }

            return false
        },
        { label: `index ${collectionId}.${key}` }
    )
}

async function ensureStringAttribute(
    databases,
    databaseId,
    collectionId,
    key,
    { size = 255, required = false, defaultValue = null, array = false } = {}
) {
    const existing = await tryGet(() =>
        callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    )

    if (existing) {
        await waitForAttributeAvailable(databases, databaseId, collectionId, key)
        await delay(60)
        return
    }

    await safeCall(
        () =>
            callDb(
                databases,
                "createStringAttribute",
                {
                    databaseId,
                    collectionId,
                    key,
                    size,
                    required,
                    default: defaultValue,
                    array,
                },
                [databaseId, collectionId, key, size, required, defaultValue, array]
            ),
        { label: `createStringAttribute ${collectionId}.${key}` }
    )

    await waitForAttributeAvailable(databases, databaseId, collectionId, key)
    await delay(60)
}

async function ensureKeyIndex(databases, databaseId, collectionId, key, attributes) {
    const existing = await tryGet(() =>
        callDb(databases, "getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    )

    if (existing) {
        await waitForIndexAvailable(databases, databaseId, collectionId, key)
        await delay(60)
        return
    }

    for (const attrKey of attributes) {
        await waitForAttributeAvailable(databases, databaseId, collectionId, attrKey)
    }

    const orders = attributes.map(() => "ASC")

    await safeCall(
        () =>
            callDb(
                databases,
                "createIndex",
                { databaseId, collectionId, key, type: "key", attributes, orders },
                [databaseId, collectionId, key, "key", attributes, orders]
            ),
        { label: `createIndex key ${collectionId}.${key}` }
    )

    await waitForIndexAvailable(databases, databaseId, collectionId, key)
    await delay(60)
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

        await delay(100)
    }
}

function buildTermLabel(term) {
    const schoolYear = str(term?.schoolYear)
    const semester = str(term?.semester)

    if (schoolYear && semester) return `${schoolYear} • ${semester}`
    return schoolYear || semester || str(term?.label) || str(term?.name) || str(term?.title) || "Academic Term"
}

function buildSubjectSectionLinkPayload({ subject, section, term }) {
    const sectionId = str(section?.$id)
    const sectionProgramId = str(section?.programId)
    const sectionDepartmentId = str(section?.departmentId)
    const sectionYearLevel =
        extractSectionYearNumber(section?.yearLevel) || normalizeYearLevel(section?.yearLevel)
    const nextTermId =
        str(subject?.termId) ||
        str(section?.termId) ||
        str(term?.$id) ||
        null
    const nextSemester =
        str(subject?.semester) ||
        str(section?.semester) ||
        str(term?.semester) ||
        null

    const programIds = uniqueStrings([
        ...resolveSubjectProgramIds(subject),
        sectionProgramId,
    ])

    const yearLevels = uniqueStrings([
        ...resolveSubjectYearLevels(subject),
        sectionYearLevel,
    ])

    const sectionIds = uniqueStrings([
        ...resolveSubjectSectionIds(subject),
        sectionId,
    ])

    const linkedSectionIds = uniqueStrings([
        ...resolveSubjectLinkedSectionIds(subject),
        sectionId,
    ])

    return {
        departmentId: sectionDepartmentId || str(subject?.departmentId) || null,
        programId: sectionProgramId || programIds[0] || str(subject?.programId) || null,
        programIds,
        yearLevel: sectionYearLevel || yearLevels[0] || normalizeYearLevel(subject?.yearLevel) || null,
        yearLevels,
        termId: nextTermId,
        semester: nextSemester,
        sectionId: sectionIds[0] || null,
        sectionIds,
        linkedSectionId: linkedSectionIds[0] || null,
        linkedSectionIds,
    }
}

export const id = MIGRATION_ID
export const name = "Link section subject references into subjects and academic terms"

export async function up(context = {}) {
    const databases = context.databases || createFallbackDatabases()
    const databaseId = resolveDatabaseId(context.databaseId)
    const log = context.log || console

    if (!databaseId) {
        throw new Error(`Missing databaseId for migration ${MIGRATION_ID}.`)
    }

    await waitForCollection(databases, databaseId, SUBJECTS_COLLECTION_ID)

    await ensureStringAttribute(databases, databaseId, SUBJECTS_COLLECTION_ID, "sectionId", {
        size: 255,
        required: false,
        defaultValue: null,
        array: false,
    })

    await ensureStringAttribute(databases, databaseId, SUBJECTS_COLLECTION_ID, "sectionIds", {
        size: 255,
        required: false,
        defaultValue: null,
        array: true,
    })

    await ensureStringAttribute(databases, databaseId, SUBJECTS_COLLECTION_ID, "linkedSectionId", {
        size: 255,
        required: false,
        defaultValue: null,
        array: false,
    })

    await ensureStringAttribute(databases, databaseId, SUBJECTS_COLLECTION_ID, "linkedSectionIds", {
        size: 255,
        required: false,
        defaultValue: null,
        array: true,
    })

    await ensureKeyIndex(
        databases,
        databaseId,
        SUBJECTS_COLLECTION_ID,
        "idx_subjects_linkedSectionId",
        ["linkedSectionId"]
    )

    const [sections, subjects, terms] = await Promise.all([
        listAllDocuments(databases, databaseId, SECTIONS_COLLECTION_ID),
        listAllDocuments(databases, databaseId, SUBJECTS_COLLECTION_ID),
        listAllDocuments(databases, databaseId, TERMS_COLLECTION_ID),
    ])

    const subjectById = new Map(subjects.map((subject) => [str(subject?.$id), subject]))
    const termById = new Map(terms.map((term) => [str(term?.$id), term]))

    let scannedSections = 0
    let touchedSubjects = 0
    let updatedSubjects = 0
    const failed = []

    for (const section of sections) {
        const subjectIds = resolveSectionSubjectIds(section)
        if (subjectIds.length === 0) continue

        scannedSections += 1
        const linkedTerm = termById.get(str(section?.termId)) || null

        for (const subjectId of subjectIds) {
            const subject = subjectById.get(subjectId)
            if (!subject) {
                failed.push(`subject ${subjectId} not found for section ${str(section?.$id)}`)
                continue
            }

            touchedSubjects += 1

            try {
                const payload = buildSubjectSectionLinkPayload({
                    subject,
                    section,
                    term: linkedTerm,
                })

                await databases.updateDocument(databaseId, SUBJECTS_COLLECTION_ID, subjectId, payload)

                subjectById.set(subjectId, { ...subject, ...payload })
                updatedSubjects += 1
            } catch (error) {
                failed.push(
                    `${str(subject?.code) || subjectId} <- ${str(section?.$id)} (${error?.message || "update failed"})`
                )
            }
        }
    }

    log.info?.(
        `✅ ${MIGRATION_ID}: scanned ${scannedSections} section(s), touched ${touchedSubjects} subject link(s), updated ${updatedSubjects} subject document(s).`
    )

    if (failed.length > 0) {
        log.warn?.(`⚠️ ${MIGRATION_ID}: ${failed.length} failure(s): ${failed.join("; ")}`)
    }

    log.info?.(
        `ℹ️ ${MIGRATION_ID}: added subject attributes sectionId, sectionIds, linkedSectionId, linkedSectionIds and backfilled section-to-subject term links where reusable sections already referenced subjects.`
    )
}

export default {
    id,
    name,
    up,
}
