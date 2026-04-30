import { Client, Databases, ID, Permission, Query, Role } from "node-appwrite"

const MIGRATION_ID = "020_persist_subject_matching_filters"
const SETTINGS_COLLECTION_ID = "settings"
const SUBJECT_MATCHING_FILTERS_SETTING_KEY = "admin_schedules.subject_matching_filters"
const SUBJECT_MATCHING_FILTERS_DESCRIPTION = "Saved Subject Matching Filters for the admin schedule planner."

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

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
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

async function ensureSettingsCollection(databases, databaseId) {
    const existing = await tryGet(() =>
        callDb(databases, "getCollection", { databaseId, collectionId: SETTINGS_COLLECTION_ID }, [databaseId, SETTINGS_COLLECTION_ID])
    )

    if (existing) {
        await waitForCollection(databases, databaseId, SETTINGS_COLLECTION_ID)
        return
    }

    const permissions = [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
    ]

    await safeCall(
        () =>
            callDb(
                databases,
                "createCollection",
                {
                    databaseId,
                    collectionId: SETTINGS_COLLECTION_ID,
                    name: "Settings",
                    permissions,
                    documentSecurity: false,
                    enabled: true,
                },
                [databaseId, SETTINGS_COLLECTION_ID, "Settings", permissions, false, true]
            ),
        { label: `createCollection ${SETTINGS_COLLECTION_ID}` }
    )

    await waitForCollection(databases, databaseId, SETTINGS_COLLECTION_ID)
    await delay(150)
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

async function ensureKeyIndex(databases, databaseId, collectionId, key, attributes, type = "key") {
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
                { databaseId, collectionId, key, type, attributes, orders },
                [databaseId, collectionId, key, type, attributes, orders]
            ),
        { label: `createIndex ${type} ${collectionId}.${key}` }
    )

    await waitForIndexAvailable(databases, databaseId, collectionId, key)
    await delay(60)
}

function defaultSubjectMatchingFiltersValue() {
    return JSON.stringify({
        showConflictsOnly: false,
        subjectCollegeFilter: "__all__",
        subjectProgramFilters: [],
        subjectSectionFilters: [],
        subjectYearLevelFilters: [],
        subjectAcademicTermFilter: "__all__",
    })
}

async function findSettingByKey(databases, databaseId, key) {
    const response = await callDb(
        databases,
        "listDocuments",
        {
            databaseId,
            collectionId: SETTINGS_COLLECTION_ID,
            queries: [Query.equal("key", key), Query.limit(1)],
        },
        [databaseId, SETTINGS_COLLECTION_ID, [Query.equal("key", key), Query.limit(1)]]
    )

    return Array.isArray(response?.documents) ? response.documents[0] || null : null
}

async function ensureDefaultSubjectMatchingFiltersSetting(databases, databaseId) {
    const existing = await findSettingByKey(databases, databaseId, SUBJECT_MATCHING_FILTERS_SETTING_KEY)
    if (existing?.$id) return false

    await safeCall(
        () =>
            callDb(
                databases,
                "createDocument",
                {
                    databaseId,
                    collectionId: SETTINGS_COLLECTION_ID,
                    documentId: ID.unique(),
                    data: {
                        key: SUBJECT_MATCHING_FILTERS_SETTING_KEY,
                        value: defaultSubjectMatchingFiltersValue(),
                        description: SUBJECT_MATCHING_FILTERS_DESCRIPTION,
                        updatedAt: new Date().toISOString(),
                    },
                },
                [
                    databaseId,
                    SETTINGS_COLLECTION_ID,
                    ID.unique(),
                    {
                        key: SUBJECT_MATCHING_FILTERS_SETTING_KEY,
                        value: defaultSubjectMatchingFiltersValue(),
                        description: SUBJECT_MATCHING_FILTERS_DESCRIPTION,
                        updatedAt: new Date().toISOString(),
                    },
                ]
            ),
        { label: `create default setting ${SUBJECT_MATCHING_FILTERS_SETTING_KEY}` }
    )

    return true
}

export const id = MIGRATION_ID
export const name = "Persist Subject Matching Filters"

export async function up(context = {}) {
    const databases = context.databases || createFallbackDatabases()
    const databaseId = resolveDatabaseId(context.databaseId)
    const log = context.log || console

    if (!databaseId) {
        throw new Error(`Missing databaseId for migration ${MIGRATION_ID}.`)
    }

    await ensureSettingsCollection(databases, databaseId)

    await ensureStringAttribute(databases, databaseId, SETTINGS_COLLECTION_ID, "key", {
        size: 255,
        required: true,
    })

    await ensureStringAttribute(databases, databaseId, SETTINGS_COLLECTION_ID, "value", {
        size: 65535,
        required: true,
    })

    await ensureStringAttribute(databases, databaseId, SETTINGS_COLLECTION_ID, "description", {
        size: 1000,
        required: false,
        defaultValue: null,
    })

    await ensureStringAttribute(databases, databaseId, SETTINGS_COLLECTION_ID, "updatedBy", {
        size: 255,
        required: false,
        defaultValue: null,
    })

    await ensureStringAttribute(databases, databaseId, SETTINGS_COLLECTION_ID, "updatedAt", {
        size: 64,
        required: false,
        defaultValue: null,
    })

    await ensureKeyIndex(databases, databaseId, SETTINGS_COLLECTION_ID, "idx_settings_key_unique", ["key"], "unique")

    const createdDefaultSetting = await ensureDefaultSubjectMatchingFiltersSetting(databases, databaseId)

    log.info?.(
        `✅ ${MIGRATION_ID}: ensured settings collection attributes, unique key index, and ${createdDefaultSetting ? "created" : "kept"} the default Subject Matching Filters setting.`
    )
}

export default {
    id,
    name,
    up,
}