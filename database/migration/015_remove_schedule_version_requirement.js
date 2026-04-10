import { Client, Databases } from "node-appwrite"

const MIGRATION_ID = "015_remove_schedule_version_requirement"
const VERSION_ATTRIBUTE_KEY = "versionId"
const TARGET_COLLECTION_IDS = ["classes", "class_meetings"]

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

async function waitForAttributeDeletion(databases, databaseId, collectionId, key) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await databases.listAttributes(databaseId, collectionId)
        const attributes = Array.isArray(response?.attributes) ? response.attributes : []
        const stillExists = attributes.some((attribute) => String(attribute?.key || "") === key)

        if (!stillExists) {
            return
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error(`Timed out while waiting for ${collectionId}.${key} to be deleted.`)
}

async function removeVersionAttributeIfPresent(databases, databaseId, collectionId, log = console) {
    const response = await databases.listAttributes(databaseId, collectionId)
    const attributes = Array.isArray(response?.attributes) ? response.attributes : []
    const versionAttribute = attributes.find((attribute) => String(attribute?.key || "") === VERSION_ATTRIBUTE_KEY)

    if (!versionAttribute) {
        log.info?.(`⏭️  ${collectionId}.${VERSION_ATTRIBUTE_KEY} not found. Skipping.`)
        return
    }

    log.info?.(`🗑️  Removing ${collectionId}.${VERSION_ATTRIBUTE_KEY}...`)
    await databases.deleteAttribute(databaseId, collectionId, VERSION_ATTRIBUTE_KEY)
    await waitForAttributeDeletion(databases, databaseId, collectionId, VERSION_ATTRIBUTE_KEY)
    log.info?.(`✅ Removed ${collectionId}.${VERSION_ATTRIBUTE_KEY}.`)
}

export const id = MIGRATION_ID
export const name = "Remove schedule version requirement"

export async function up(context = {}) {
    const databases = context.databases || createFallbackDatabases()
    const databaseId = resolveDatabaseId(context.databaseId)
    const log = context.log || console

    if (!databaseId) {
        throw new Error("Missing databaseId for migration 015_remove_schedule_version_requirement.")
    }

    for (const collectionId of TARGET_COLLECTION_IDS) {
        await removeVersionAttributeIfPresent(databases, databaseId, collectionId, log)
    }
}

export default {
    id,
    name,
    up,
}