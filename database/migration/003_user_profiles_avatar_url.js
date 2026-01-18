import { Permission, Role } from "node-appwrite";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appwrite (v1.8.x) does NOT allow default values on REQUIRED attributes.
 * This project historically used `null` to represent "no default".
 */
function normalizeDefault(required, def) {
    return required ? null : def;
}

async function safeCall(fn, { onExists = "skip", label = "" } = {}) {
    try {
        return await fn();
    } catch (err) {
        if (err?.code === 409) {
            if (onExists === "skip") return null;
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

export const COLLECTIONS = {
    USER_PROFILES: "user_profiles",
};

export const id = "003_user_profiles_avatar_url";

/**
 * @param {{ databases: import("node-appwrite").Databases, databaseId: string }} ctx
 */
export async function up({ databases, databaseId }) {
    // ✅ Ensure collection exists before adding new attribute
    await waitForCollection(databases, databaseId, COLLECTIONS.USER_PROFILES);

    // ✅ Add avatarUrl column to user_profiles
    // - optional string
    // - allow long URLs
    await ensureString(databases, databaseId, COLLECTIONS.USER_PROFILES, "avatarUrl", 2048, false);

    console.log("✅ Migration 003_user_profiles_avatar_url complete.");
}

export default { id, up, COLLECTIONS };
