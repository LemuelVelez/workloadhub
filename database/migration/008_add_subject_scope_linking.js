const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

            const status = String(attr?.status || "").toLowerCase();
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

            const status = String(idx?.status || "").toLowerCase();
            if (status === "available") return true;

            if ((status === "failed" || status === "stuck") && idx?.error) {
                throw new Error(`Index ${collectionId}.${key} status=${idx.status} error=${idx.error}`);
            }

            return false;
        },
        { label: `index ${collectionId}.${key}` }
    );
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
    );

    if (existing) {
        await waitForAttributeAvailable(databases, databaseId, collectionId, key);
        await delay(60);
        return;
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
    );

    await waitForAttributeAvailable(databases, databaseId, collectionId, key);
    await delay(60);
}

async function ensureKeyIndex(databases, databaseId, collectionId, key, attributes) {
    const existing = await tryGet(() =>
        callDb(databases, "getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (existing) {
        await waitForIndexAvailable(databases, databaseId, collectionId, key);
        await delay(60);
        return;
    }

    for (const attrKey of attributes) {
        await waitForAttributeAvailable(databases, databaseId, collectionId, attrKey);
    }

    const orders = attributes.map(() => "ASC");

    await safeCall(
        () =>
            callDb(
                databases,
                "createIndex",
                { databaseId, collectionId, key, type: "key", attributes, orders },
                [databaseId, collectionId, key, "key", attributes, orders]
            ),
        { label: `createIndex key ${collectionId}.${key}` }
    );

    await waitForIndexAvailable(databases, databaseId, collectionId, key);
    await delay(60);
}

export const COLLECTIONS = {
    SUBJECTS: "subjects",
};

export const ATTR = {
    SUBJECTS: {
        programId: "programId",
        yearLevel: "yearLevel",
        termId: "termId",
    },
};

export const INDEX = {
    SUBJECTS: {
        programId: "idx_subjects_programId",
        yearLevel: "idx_subjects_yearLevel",
        termProgramYear: "idx_subjects_term_program_year",
    },
};

export const id = "008_add_subject_scope_linking";

/**
 * @param {{ databases: import("node-appwrite").Databases, databaseId: string }} ctx
 */
export async function up({ databases, databaseId }) {
    await waitForCollection(databases, databaseId, COLLECTIONS.SUBJECTS);

    await ensureStringAttribute(
        databases,
        databaseId,
        COLLECTIONS.SUBJECTS,
        ATTR.SUBJECTS.programId,
        {
            size: 255,
            required: false,
            defaultValue: null,
            array: false,
        }
    );

    await ensureStringAttribute(
        databases,
        databaseId,
        COLLECTIONS.SUBJECTS,
        ATTR.SUBJECTS.yearLevel,
        {
            size: 64,
            required: false,
            defaultValue: null,
            array: false,
        }
    );

    await ensureKeyIndex(
        databases,
        databaseId,
        COLLECTIONS.SUBJECTS,
        INDEX.SUBJECTS.programId,
        [ATTR.SUBJECTS.programId]
    );

    await ensureKeyIndex(
        databases,
        databaseId,
        COLLECTIONS.SUBJECTS,
        INDEX.SUBJECTS.yearLevel,
        [ATTR.SUBJECTS.yearLevel]
    );

    await ensureKeyIndex(
        databases,
        databaseId,
        COLLECTIONS.SUBJECTS,
        INDEX.SUBJECTS.termProgramYear,
        [ATTR.SUBJECTS.termId, ATTR.SUBJECTS.programId, ATTR.SUBJECTS.yearLevel]
    );

    console.log(
        `✅ Migration ${id} complete. Added optional subject scope fields (${ATTR.SUBJECTS.programId}, ${ATTR.SUBJECTS.yearLevel}) and indexes for subject-to-program/year/term filtering.`
    );
    console.log(
        "ℹ️ Existing subjects are not force-backfilled here. Update subjects through Master Data so they match the intended program, year level, and semester scope."
    );
}

export default { id, up, COLLECTIONS, ATTR, INDEX };