import { Permission, Role } from "node-appwrite";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appwrite (v1.8.x) does NOT allow default values on REQUIRED attributes.
 * This project historically used `null` to represent "no default".
 */
function normalizeDefault(required, def) {
    return required ? null : def;
}

/**
 * Calls node-appwrite methods safely with "exists" handling.
 */
async function safeCall(fn, { onExists = "skip", label = "" } = {}) {
    try {
        return await fn();
    } catch (err) {
        // Appwrite "already exists" is commonly 409
        if (err?.code === 409) {
            if (onExists === "skip") return null;
        }
        console.error(`❌ Failed: ${label}`);
        console.error(err);
        throw err;
    }
}

/**
 * node-appwrite has had versions where methods accept positional arguments
 * and versions where methods accept a single "params object".
 * This helper supports BOTH.
 */
async function callDb(databases, methodName, paramsObject, paramsPositional = []) {
    const fn = databases?.[methodName];
    if (typeof fn !== "function") {
        throw new Error(`Databases SDK method not found: databases.${methodName}()`);
    }

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

async function ensureCollection(databases, databaseId, collectionId, name, permissions, documentSecurity = true) {
    const existing = await tryGet(() =>
        callDb(databases, "getCollection", { databaseId, collectionId }, [databaseId, collectionId])
    );

    if (!existing) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "createCollection",
                    { databaseId, collectionId, name, permissions, documentSecurity },
                    [databaseId, collectionId, name, permissions, documentSecurity]
                ),
            { label: `createCollection ${collectionId}` }
        );
    }

    await waitForCollection(databases, databaseId, collectionId);
    await delay(80);
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

async function ensureDatetime(databases, databaseId, collectionId, key, required, def = null, array = false) {
    const normalizedDefault = normalizeDefault(required, def);

    const existing = await tryGet(() =>
        callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (!existing) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "createDatetimeAttribute",
                    { databaseId, collectionId, key, required, default: normalizedDefault, array },
                    [databaseId, collectionId, key, required, normalizedDefault, array]
                ),
            { label: `createDatetimeAttribute ${collectionId}.${key}` }
        );
    }

    await waitForAttributeAvailable(databases, databaseId, collectionId, key);
    await delay(40);
}

async function ensureIndex(databases, databaseId, collectionId, key, type, attributes, orders = []) {
    const existing = await tryGet(() =>
        callDb(databases, "getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (existing) {
        await waitForIndexAvailable(databases, databaseId, collectionId, key);
        await delay(40);
        return;
    }

    for (const attrKey of attributes) {
        await waitForAttributeAvailable(databases, databaseId, collectionId, attrKey);
    }

    await safeCall(
        () =>
            callDb(
                databases,
                "createIndex",
                { databaseId, collectionId, key, type, attributes, orders },
                [databaseId, collectionId, key, type, attributes, orders]
            ),
        { label: `createIndex ${collectionId}.${key}` }
    );

    await waitForIndexAvailable(databases, databaseId, collectionId, key);
    await delay(60);
}

export const COLLECTIONS = {
    FIRST_LOGIN_USERS: "first_login_users",
};

export const id = "002_first_login_users";

/**
 * @param {{ databases: import("node-appwrite").Databases, databaseId: string }} ctx
 */
export async function up({ databases, databaseId }) {
    const permsCRUD = [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
    ];

    await ensureCollection(
        databases,
        databaseId,
        COLLECTIONS.FIRST_LOGIN_USERS,
        "First Login Users (Gate)",
        permsCRUD,
        true
    );

    await ensureString(databases, databaseId, COLLECTIONS.FIRST_LOGIN_USERS, "userId", 64, true);

    // ✅ These determine if password change is required by the "first-time user gate"
    await ensureBoolean(databases, databaseId, COLLECTIONS.FIRST_LOGIN_USERS, "mustChangePassword", true);
    await ensureBoolean(databases, databaseId, COLLECTIONS.FIRST_LOGIN_USERS, "completed", true);

    await ensureDatetime(databases, databaseId, COLLECTIONS.FIRST_LOGIN_USERS, "createdAt", false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.FIRST_LOGIN_USERS, "completedAt", false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.FIRST_LOGIN_USERS, "lastResetAt", false);

    await ensureIndex(
        databases,
        databaseId,
        COLLECTIONS.FIRST_LOGIN_USERS,
        "idx_firstlogin_userId_unique",
        "unique",
        ["userId"]
    );

    await ensureIndex(
        databases,
        databaseId,
        COLLECTIONS.FIRST_LOGIN_USERS,
        "idx_firstlogin_completed",
        "key",
        ["completed"]
    );

    console.log("✅ Migration 002_first_login_users complete.");
}

export default { id, up, COLLECTIONS };
