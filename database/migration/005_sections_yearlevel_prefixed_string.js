import { Query } from "node-appwrite";

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
        if (err?.code === 409) {
            if (onExists === "skip") return null;
        }

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

    if (fn.length <= 1) {
        try {
            return await fn.call(databases, paramsObject);
        } catch {
            // fallback to positional
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

async function waitForAttributeDeleted(databases, databaseId, collectionId, key) {
    return await waitUntil(
        async () => {
            const attr = await tryGet(() =>
                callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
            );
            return !attr;
        },
        { label: `attribute deletion ${collectionId}.${key}` }
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

async function listAllDocuments(databases, databaseId, collectionId) {
    const all = [];
    const limit = 100;
    let offset = 0;

    while (true) {
        const queries = [Query.limit(limit), Query.offset(offset)];

        const page = await safeCall(
            () =>
                callDb(
                    databases,
                    "listDocuments",
                    {
                        databaseId,
                        collectionId,
                        queries,
                    },
                    [databaseId, collectionId, queries]
                ),
            { label: `listDocuments ${collectionId} offset=${offset}` }
        );

        const docs = Array.isArray(page?.documents) ? page.documents : [];
        all.push(...docs);

        if (docs.length < limit) break;
        offset += docs.length;
    }

    return all;
}

async function updateDocumentData(databases, databaseId, collectionId, documentId, data) {
    return await callDb(
        databases,
        "updateDocument",
        { databaseId, collectionId, documentId, data },
        [databaseId, collectionId, documentId, data]
    );
}

function normalizeSectionTrackPrefix(value) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    if (!normalized) return "";

    if (
        normalized === "IS" ||
        normalized === "BSIS" ||
        normalized === "INFORMATION SYSTEMS" ||
        normalized === "BS INFORMATION SYSTEMS" ||
        normalized === "INFO SYSTEMS" ||
        normalized === "INFO SYS"
    ) {
        return "IS";
    }

    if (
        normalized === "CS" ||
        normalized === "BSCS" ||
        normalized === "COMPUTER SCIENCE" ||
        normalized === "BS COMPUTER SCIENCE" ||
        normalized === "COMP SCI" ||
        normalized === "COMSCI"
    ) {
        return "CS";
    }

    return "";
}

function inferSectionTrackPrefix(values) {
    const normalizedValues = values
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean);

    if (normalizedValues.length === 0) return "";

    const directPrefix = normalizedValues
        .map((value) => normalizeSectionTrackPrefix(value))
        .find(Boolean);

    if (directPrefix) return directPrefix;

    const joined = normalizedValues.join(" ");
    const tokens = joined
        .split(/[\s/-]+/)
        .map((token) => token.trim())
        .filter(Boolean);

    if (
        tokens.includes("BSIS") ||
        tokens.includes("IS") ||
        /INFORMATION\s+SYSTEMS?/.test(joined)
    ) {
        return "IS";
    }

    if (
        tokens.includes("BSCS") ||
        tokens.includes("CS") ||
        /COMPUTER\s+SCIENCE/.test(joined)
    ) {
        return "CS";
    }

    return "";
}

function extractSectionTrackPrefixFromYearLevel(value) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    if (!normalized) return "";

    const match = normalized.match(/^(CS|IS)\s+[1-9]\d*$/);
    return match?.[1] ?? "";
}

function extractSectionYearNumber(value) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    if (!normalized) return "";

    const plain = normalized.match(/^([1-9]\d*)$/);
    if (plain) return plain[1];

    const prefixed = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/);
    if (prefixed) return prefixed[1];

    const trailing = normalized.match(/(?:^|[\s-])([1-9]\d*)$/);
    return trailing?.[1] ?? "";
}

function isResolvedYearLevel(value) {
    return /^(CS|IS)\s+[1-9]\d*$/.test(
        String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, " ")
    );
}

function buildPrefixedYearLevel({ rawYearLevel, preferredPrefix }) {
    const yearNumber = extractSectionYearNumber(rawYearLevel);
    if (!yearNumber) return "";

    const existingPrefix =
        extractSectionTrackPrefixFromYearLevel(rawYearLevel) ||
        inferSectionTrackPrefix([rawYearLevel]);

    const prefix = preferredPrefix || existingPrefix;
    return prefix ? `${prefix} ${yearNumber}` : yearNumber;
}

/**
 * Manual rescue map for truly ambiguous legacy sections.
 * Only use this if the section has no usable programId and no linked class programId.
 *
 * Example:
 * "69a8dfda00094a37f9ff": "CS",
 */
const SECTION_TRACK_PREFIX_OVERRIDES = {
    // "69a8dfda00094a37f9ff": "CS",
    // "69a8ed9e003b30c28fdc": "IS",
    // "69ae986d0036806ce019": "CS",
    // "69b1626a001b3a3254d6": "IS",
};

function resolvePrefixFromProgram(program) {
    if (!program) return "";
    return inferSectionTrackPrefix([program.code, program.name]);
}

function resolvePrefixFromClassPrograms(programIds, programById) {
    const prefixes = Array.from(
        new Set(
            programIds
                .map((programId) => programById.get(programId))
                .map((program) => resolvePrefixFromProgram(program))
                .filter(Boolean)
        )
    );

    if (prefixes.length === 1) return prefixes[0];
    return "";
}

export const COLLECTIONS = {
    SECTIONS: "sections",
    PROGRAMS: "programs",
    CLASSES: "classes",
};

export const id = "005_sections_yearlevel_prefixed_string";

/**
 * @param {{ databases: import("node-appwrite").Databases, databaseId: string }} ctx
 */
export async function up({ databases, databaseId }) {
    await waitForCollection(databases, databaseId, COLLECTIONS.SECTIONS);
    await waitForCollection(databases, databaseId, COLLECTIONS.PROGRAMS);
    await waitForCollection(databases, databaseId, COLLECTIONS.CLASSES);

    const [sectionDocs, programDocs, classDocs] = await Promise.all([
        listAllDocuments(databases, databaseId, COLLECTIONS.SECTIONS),
        listAllDocuments(databases, databaseId, COLLECTIONS.PROGRAMS),
        listAllDocuments(databases, databaseId, COLLECTIONS.CLASSES),
    ]);

    const programById = new Map(
        programDocs.map((program) => [
            String(program?.$id || ""),
            {
                code: String(program?.code || "").trim(),
                name: String(program?.name || "").trim(),
            },
        ])
    );

    const classProgramIdsBySection = new Map();

    for (const cls of classDocs) {
        const sectionId = String(cls?.sectionId || "").trim();
        const programId = String(cls?.programId || "").trim();

        if (!sectionId || !programId) continue;

        if (!classProgramIdsBySection.has(sectionId)) {
            classProgramIdsBySection.set(sectionId, new Set());
        }

        classProgramIdsBySection.get(sectionId).add(programId);
    }

    const sectionBackups = sectionDocs.map((doc) => ({
        $id: String(doc?.$id || ""),
        yearLevel: doc?.yearLevel,
        programId: String(doc?.programId || "").trim(),
    }));

    const OLD_UNIQUE_KEY = "idx_sections_term_name_unique";
    const CURRENT_UNIQUE_KEY = "idx_sec_term_dept_yr_name_u";

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

    await safeCall(
        () =>
            callDb(
                databases,
                "deleteIndex",
                { databaseId, collectionId: COLLECTIONS.SECTIONS, key: CURRENT_UNIQUE_KEY },
                [databaseId, COLLECTIONS.SECTIONS, CURRENT_UNIQUE_KEY]
            ),
        { label: `deleteIndex ${COLLECTIONS.SECTIONS}.${CURRENT_UNIQUE_KEY}`, onNotFound: "skip" }
    );

    const existingYearLevelAttr = await tryGet(() =>
        callDb(
            databases,
            "getAttribute",
            { databaseId, collectionId: COLLECTIONS.SECTIONS, key: "yearLevel" },
            [databaseId, COLLECTIONS.SECTIONS, "yearLevel"]
        )
    );

    const needsRecreate =
        !existingYearLevelAttr || String(existingYearLevelAttr?.type || "").toLowerCase() !== "string";

    if (needsRecreate && existingYearLevelAttr) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "deleteAttribute",
                    { databaseId, collectionId: COLLECTIONS.SECTIONS, key: "yearLevel" },
                    [databaseId, COLLECTIONS.SECTIONS, "yearLevel"]
                ),
            { label: `deleteAttribute ${COLLECTIONS.SECTIONS}.yearLevel`, onNotFound: "skip" }
        );

        await waitForAttributeDeleted(databases, databaseId, COLLECTIONS.SECTIONS, "yearLevel");
        await delay(100);
    }

    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "yearLevel", 16, true);

    let unresolvedCount = 0;
    let updatedCount = 0;

    for (const backup of sectionBackups) {
        if (!backup.$id) continue;

        const classProgramIds = classProgramIdsBySection.get(backup.$id)
            ? Array.from(classProgramIdsBySection.get(backup.$id))
            : [];

        const overridePrefix = normalizeSectionTrackPrefix(
            SECTION_TRACK_PREFIX_OVERRIDES[backup.$id]
        );

        const sectionProgramPrefix = resolvePrefixFromProgram(
            programById.get(backup.programId)
        );

        const classProgramPrefix = resolvePrefixFromClassPrograms(
            classProgramIds,
            programById
        );

        const preferredPrefix =
            overridePrefix ||
            sectionProgramPrefix ||
            classProgramPrefix;

        const nextYearLevel =
            buildPrefixedYearLevel({
                rawYearLevel: backup.yearLevel,
                preferredPrefix,
            }) || String(backup.yearLevel ?? "").trim();

        if (!nextYearLevel) continue;

        if (!isResolvedYearLevel(nextYearLevel)) {
            unresolvedCount += 1;
            console.warn(
                `⚠️ Could not fully resolve CS/IS prefix for section ${backup.$id}. Preserving value: ${nextYearLevel} | section.programId=${backup.programId || "—"} | class.programIds=${classProgramIds.join(", ") || "—"}`
            );
        }

        await safeCall(
            () =>
                updateDocumentData(databases, databaseId, COLLECTIONS.SECTIONS, backup.$id, {
                    yearLevel: nextYearLevel,
                }),
            { label: `updateDocument ${COLLECTIONS.SECTIONS}.${backup.$id}` }
        );

        updatedCount += 1;
        await delay(20);
    }

    if (unresolvedCount === 0) {
        await ensureUniqueIndex(databases, databaseId, COLLECTIONS.SECTIONS, CURRENT_UNIQUE_KEY, [
            "termId",
            "departmentId",
            "yearLevel",
            "name",
        ]);
    } else {
        console.warn(
            `⚠️ Skipping unique index ${CURRENT_UNIQUE_KEY} in migration ${id} because ${unresolvedCount} section(s) still have unresolved CS/IS prefixes. Migration 006 will finish the backfill and create the unique index.`
        );
    }

    console.log(
        `✅ Migration 005_sections_yearlevel_prefixed_string complete. Updated ${updatedCount} section(s). Unresolved prefix count: ${unresolvedCount}.`
    );
}

export default { id, up, COLLECTIONS };