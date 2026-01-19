import { Permission, Role } from "node-appwrite";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appwrite (v1.8.x) does NOT allow default values on REQUIRED attributes.
 * This project historically used `null` to represent "no default".
 */
function normalizeDefault(required, def) {
    return required ? null : def;
}

async function safeCall(fn, { onExists = "skip", onNotFound = "skip", label = "" } = {}) {
    try {
        return await fn();
    } catch (err) {
        // 409 = already exists (attribute/index)
        if (err?.code === 409) {
            if (onExists === "skip") return null;
        }
        // 404 = not found (delete old index, etc.)
        if (err?.code === 404) {
            if (onNotFound === "skip") return null;
        }

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

    // supports newer SDK (single params object)
    if (fn.length <= 1) {
        try {
            return await fn.call(databases, paramsObject);
        } catch {
            // fall back to positional
        }
    }

    return await fn.call(databases, ...paramsPositional);
}

async function tryGet(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err?.code === 404) return null;
        return null;
    }
}

async function waitUntil(
    checkFn,
    { label, timeoutMs = 120000, startDelayMs = 200, maxDelayMs = 2000 } = {}
) {
    const started = Date.now();
    let sleep = startDelayMs;
    let lastErr = null;

    while (true) {
        try {
            const res = await checkFn();
            if (res) return res;
        } catch (err) {
            lastErr = err;
        }

        if (Date.now() - started > timeoutMs) {
            const lastMsg =
                lastErr?.message ||
                lastErr?.response ||
                (typeof lastErr === "string" ? lastErr : JSON.stringify(lastErr || {}));
            throw new Error(`Timeout while waiting for ${label}. Last error: ${lastMsg}`);
        }

        await delay(sleep);
        sleep = Math.min(Math.floor(sleep * 1.35), maxDelayMs);
    }
}

async function waitForCollection(databases, databaseId, collectionId) {
    return await waitUntil(
        async () => {
            const col = await tryGet(() =>
                callDb(databases, "getCollection", { databaseId, collectionId }, [databaseId, collectionId])
            );
            return !!col;
        },
        { label: `collection ${collectionId}` }
    );
}

async function waitForAttributeAvailable(databases, databaseId, collectionId, key) {
    return await waitUntil(
        async () => {
            const attr = await tryGet(() =>
                callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
            );
            if (!attr) return false;

            const status = (attr?.status || "").toLowerCase();
            if (status === "available") return true;

            if ((status === "failed" || status === "stuck") && attr?.error) {
                throw new Error(`Attribute ${collectionId}.${key} status=${attr.status} error=${attr.error}`);
            }

            return false;
        },
        { label: `attribute ${collectionId}.${key}` }
    );
}

async function waitForIndexAvailable(databases, databaseId, collectionId, key) {
    return await waitUntil(
        async () => {
            const idx = await tryGet(() =>
                callDb(databases, "getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
            );
            if (!idx) return false;

            const status = (idx?.status || "").toLowerCase();
            if (status === "available") return true;

            if ((status === "failed" || status === "stuck") && idx?.error) {
                throw new Error(`Index ${collectionId}.${key} status=${idx.status} error=${idx.error}`);
            }

            return false;
        },
        { label: `index ${collectionId}.${key}` }
    );
}

async function ensureString(databases, databaseId, collectionId, key, size, required, def = null, array = false) {
    const normalizedDefault = normalizeDefault(required, def);

    const existing = await tryGet(() =>
        callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (!existing) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "createStringAttribute",
                    { databaseId, collectionId, key, size, required, default: normalizedDefault, array },
                    [databaseId, collectionId, key, size, required, normalizedDefault, array]
                ),
            { label: `createStringAttribute ${collectionId}.${key}` }
        );
    }

    await waitForAttributeAvailable(databases, databaseId, collectionId, key);
    await delay(40);
}

async function ensureInteger(
    databases,
    databaseId,
    collectionId,
    key,
    required,
    min = 0,
    max = 999999,
    def = null,
    array = false
) {
    const normalizedDefault = normalizeDefault(required, def);

    const existing = await tryGet(() =>
        callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (!existing) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "createIntegerAttribute",
                    {
                        databaseId,
                        collectionId,
                        key,
                        required,
                        min,
                        max,
                        default: normalizedDefault,
                        array,
                    },
                    [databaseId, collectionId, key, required, min, max, normalizedDefault, array]
                ),
            { label: `createIntegerAttribute ${collectionId}.${key}` }
        );
    }

    await waitForAttributeAvailable(databases, databaseId, collectionId, key);
    await delay(40);
}

async function ensureBoolean(databases, databaseId, collectionId, key, required, def = null, array = false) {
    const normalizedDefault = normalizeDefault(required, def);

    const existing = await tryGet(() =>
        callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (!existing) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "createBooleanAttribute",
                    { databaseId, collectionId, key, required, default: normalizedDefault, array },
                    [databaseId, collectionId, key, required, normalizedDefault, array]
                ),
            { label: `createBooleanAttribute ${collectionId}.${key}` }
        );
    }

    await waitForAttributeAvailable(databases, databaseId, collectionId, key);
    await delay(40);
}

async function ensureUniqueIndex(databases, databaseId, collectionId, key, attributes) {
    const existing = await tryGet(() =>
        callDb(databases, "getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (!existing) {
        const orders = attributes.map(() => "ASC");

        await safeCall(
            () =>
                callDb(
                    databases,
                    "createIndex",
                    { databaseId, collectionId, key, type: "unique", attributes, orders },
                    [databaseId, collectionId, key, "unique", attributes, orders]
                ),
            { label: `createIndex unique ${collectionId}.${key}` }
        );
    }

    await waitForIndexAvailable(databases, databaseId, collectionId, key);
    await delay(60);
}

export const COLLECTIONS = {
    SECTIONS: "sections",
};

export const id = "004_sections_yearlevel_name_unique";

/**
 * @param {{ databases: import("node-appwrite").Databases, databaseId: string }} ctx
 */
export async function up({ databases, databaseId }) {
    // ✅ Ensure sections collection exists
    await waitForCollection(databases, databaseId, COLLECTIONS.SECTIONS);

    /**
     * ✅ Ensure core attributes exist
     * NOTE: This migration does NOT enforce enum values (Appwrite has no enum type).
     * The "A-Z + Others" restriction is handled on frontend via schemaModel options.
     */
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "departmentId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "programId", 64, false);
    await ensureInteger(databases, databaseId, COLLECTIONS.SECTIONS, "yearLevel", true, 1, 10);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "name", 32, true);
    await ensureInteger(databases, databaseId, COLLECTIONS.SECTIONS, "studentCount", false, 0, 10000);
    await ensureBoolean(databases, databaseId, COLLECTIONS.SECTIONS, "isActive", false, true);

    /**
     * ✅ IMPORTANT:
     * Old index "idx_sections_term_name_unique" will break A-Z usage across year levels.
     * Example:
     * - Year 1 - A
     * - Year 2 - A
     * These MUST be allowed.
     *
     * So we delete the old index (if it exists), then create new unique index:
     * termId + departmentId + yearLevel + name
     */
    const OLD_UNIQUE_KEY = "idx_sections_term_name_unique";

    /**
     * ✅ FIXED:
     * Appwrite index keys must be <= 36 chars.
     * Old: "idx_sections_term_dept_year_name_unique" (too long)
     * New: "idx_sec_term_dept_yr_name_u" ✅ safe length
     */
    const NEW_UNIQUE_KEY = "idx_sec_term_dept_yr_name_u";

    await safeCall(
        () =>
            callDb(
                databases,
                "deleteIndex",
                { databaseId, collectionId: COLLECTIONS.SECTIONS, key: OLD_UNIQUE_KEY },
                [databaseId, COLLECTIONS.SECTIONS, OLD_UNIQUE_KEY]
            ),
        { label: `deleteIndex ${COLLECTIONS.SECTIONS}.${OLD_UNIQUE_KEY}`, onNotFound: "skip" }
    );

    await ensureUniqueIndex(databases, databaseId, COLLECTIONS.SECTIONS, NEW_UNIQUE_KEY, [
        "termId",
        "departmentId",
        "yearLevel",
        "name",
    ]);

    console.log("✅ Migration 004_sections_yearlevel_name_unique complete.");
}

export default { id, up, COLLECTIONS };
