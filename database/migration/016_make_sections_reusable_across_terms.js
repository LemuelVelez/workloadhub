import { Client, Databases } from "node-appwrite"

const MIGRATION_ID = "016_make_sections_reusable_across_terms"
const SECTIONS_COLLECTION_ID = "sections"
const LEGACY_ATTRIBUTE_KEYS = ["termId", "semester", "academicTermLabel"]
const LEGACY_UNIQUE_INDEX_KEY = "idx_sec_term_dept_yr_name_u"
const REUSABLE_UNIQUE_INDEX_KEY = "idx_sec_dept_yr_name_u"
const REUSABLE_UNIQUE_INDEX_ATTRIBUTES = ["departmentId", "yearLevel", "name"]

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

async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForAttributeDeletion(databases, databaseId, collectionId, key) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await databases.listAttributes(databaseId, collectionId)
        const attributes = Array.isArray(response?.attributes) ? response.attributes : []
        const stillExists = attributes.some((attribute) => String(attribute?.key || "") === key)

        if (!stillExists) {
            return
        }

        await wait(1000)
    }

    throw new Error(`Timed out while waiting for ${collectionId}.${key} to be deleted.`)
}

async function waitForIndexDeletion(databases, databaseId, collectionId, key) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await databases.listIndexes(databaseId, collectionId)
        const indexes = Array.isArray(response?.indexes) ? response.indexes : []
        const stillExists = indexes.some((index) => String(index?.key || "") === key)

        if (!stillExists) {
            return
        }

        await wait(1000)
    }

    throw new Error(`Timed out while waiting for index ${collectionId}.${key} to be deleted.`)
}

async function waitForIndexAvailability(databases, databaseId, collectionId, key) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await databases.listIndexes(databaseId, collectionId)
        const indexes = Array.isArray(response?.indexes) ? response.indexes : []
        const targetIndex = indexes.find((index) => String(index?.key || "") === key)

        if (targetIndex && String(targetIndex?.status || "").toLowerCase() === "available") {
            return
        }

        await wait(1000)
    }

    throw new Error(`Timed out while waiting for index ${collectionId}.${key} to become available.`)
}

async function deleteLegacySectionAttributeIfPresent(databases, databaseId, key, log = console) {
    const response = await databases.listAttributes(databaseId, SECTIONS_COLLECTION_ID)
    const attributes = Array.isArray(response?.attributes) ? response.attributes : []
    const existingAttribute = attributes.find((attribute) => String(attribute?.key || "") === key)

    if (!existingAttribute) {
        log.info?.(`⏭️  ${SECTIONS_COLLECTION_ID}.${key} not found. Skipping.`)
        return
    }

    log.info?.(`🗑️  Removing ${SECTIONS_COLLECTION_ID}.${key}...`)
    await databases.deleteAttribute(databaseId, SECTIONS_COLLECTION_ID, key)
    await waitForAttributeDeletion(databases, databaseId, SECTIONS_COLLECTION_ID, key)
    log.info?.(`✅ Removed ${SECTIONS_COLLECTION_ID}.${key}.`)
}

async function replaceSectionUniqueIndex(databases, databaseId, log = console) {
    const response = await databases.listIndexes(databaseId, SECTIONS_COLLECTION_ID)
    const indexes = Array.isArray(response?.indexes) ? response.indexes : []
    const legacyIndex = indexes.find((index) => String(index?.key || "") === LEGACY_UNIQUE_INDEX_KEY)
    const reusableIndex = indexes.find((index) => String(index?.key || "") === REUSABLE_UNIQUE_INDEX_KEY)

    if (legacyIndex) {
        log.info?.(`🗑️  Removing ${SECTIONS_COLLECTION_ID}.${LEGACY_UNIQUE_INDEX_KEY}...`)
        await databases.deleteIndex(databaseId, SECTIONS_COLLECTION_ID, LEGACY_UNIQUE_INDEX_KEY)
        await waitForIndexDeletion(databases, databaseId, SECTIONS_COLLECTION_ID, LEGACY_UNIQUE_INDEX_KEY)
        log.info?.(`✅ Removed ${SECTIONS_COLLECTION_ID}.${LEGACY_UNIQUE_INDEX_KEY}.`)
    } else {
        log.info?.(`⏭️  ${SECTIONS_COLLECTION_ID}.${LEGACY_UNIQUE_INDEX_KEY} not found. Skipping.`)
    }

    if (reusableIndex) {
        log.info?.(`⏭️  ${SECTIONS_COLLECTION_ID}.${REUSABLE_UNIQUE_INDEX_KEY} already exists. Skipping.`)
        return
    }

    log.info?.(`🆕 Creating ${SECTIONS_COLLECTION_ID}.${REUSABLE_UNIQUE_INDEX_KEY}...`)
    await databases.createIndex(
        databaseId,
        SECTIONS_COLLECTION_ID,
        REUSABLE_UNIQUE_INDEX_KEY,
        "unique",
        REUSABLE_UNIQUE_INDEX_ATTRIBUTES
    )
    await waitForIndexAvailability(databases, databaseId, SECTIONS_COLLECTION_ID, REUSABLE_UNIQUE_INDEX_KEY)
    log.info?.(`✅ Created ${SECTIONS_COLLECTION_ID}.${REUSABLE_UNIQUE_INDEX_KEY}.`)
}

export const id = MIGRATION_ID
export const name = "Make sections reusable across terms"

export async function up(context = {}) {
    const databases = context.databases || createFallbackDatabases()
    const databaseId = resolveDatabaseId(context.databaseId)
    const log = context.log || console

    if (!databaseId) {
        throw new Error("Missing databaseId for migration 016_make_sections_reusable_across_terms.")
    }

    for (const key of LEGACY_ATTRIBUTE_KEYS) {
        await deleteLegacySectionAttributeIfPresent(databases, databaseId, key, log)
    }

    await replaceSectionUniqueIndex(databases, databaseId, log)
}

export default {
    id,
    name,
    up,
}