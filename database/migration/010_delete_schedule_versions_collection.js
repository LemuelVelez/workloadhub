const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function safeCall(fn, { onExists = "skip", onNotFound = "skip", label = "" } = {}) {
    try {
        return await fn();
    } catch (err) {
        if (err?.code === 409 && onExists === "skip") return null;
        if (err?.code === 404 && onNotFound === "skip") return null;

        console.error(`❌ Failed: ${label}`);
        console.error(err);
        throw err;
    }
}

async function callDb(databases, methodName, paramsObject, paramsPositional = []) {
    const fn = databases?.[methodName];
    if (typeof fn !== "function") {
        throw new Error(`Databases SDK method not found: databases.${methodName}()`);
    }

    if (fn.length <= 1) {
        try {
            return await fn.call(databases, paramsObject);
        } catch {
            // fallback to positional signature
        }
    }

    return await fn.call(databases, ...paramsPositional);
}

export const id = "010_delete_schedule_versions_collection";
export const name = "Delete schedule_versions collection";

/**
 * @param {{ databases: import("node-appwrite").Databases, DATABASE_ID?: string, databaseId?: string, COLLECTIONS?: Record<string, string> }} ctx
 */
export async function up({ databases, DATABASE_ID, databaseId, COLLECTIONS }) {
    const resolvedDatabaseId = DATABASE_ID ?? databaseId;
    if (!resolvedDatabaseId) {
        throw new Error(`Migration ${id} requires DATABASE_ID or databaseId.`);
    }

    const collectionId = COLLECTIONS?.SCHEDULE_VERSIONS || "schedule_versions";

    console.log(`🗑️  Deleting collection: ${collectionId}`);

    await safeCall(
        () =>
            callDb(
                databases,
                "deleteCollection",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId,
                },
                [resolvedDatabaseId, collectionId]
            ),
        { onNotFound: "skip", label: `delete collection ${collectionId}` }
    );

    await delay(500);
    console.log(`✅ Deleted collection: ${collectionId}`);
}

export async function down() {
    console.warn("↩️  Rollback is not implemented for deleting schedule_versions.");
}

export default { id, name, up, down };