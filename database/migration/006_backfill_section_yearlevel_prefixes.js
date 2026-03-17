import { Query } from "node-appwrite";

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
    return prefix ? `${prefix} ${yearNumber}` : "";
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
    const prefixes = Array.from(new Set(
        programIds
            .map((programId) => programById.get(programId))
            .map((program) => resolvePrefixFromProgram(program))
            .filter(Boolean)
    ));

    if (prefixes.length === 1) return prefixes[0];
    return "";
}

export const COLLECTIONS = {
    SECTIONS: "sections",
    PROGRAMS: "programs",
    CLASSES: "classes",
};

export const id = "006_backfill_section_yearlevel_prefixes";

/**
 * @param {{ databases: import("node-appwrite").Databases, databaseId: string }} ctx
 */
export async function up({ databases, databaseId }) {
    await waitForCollection(databases, databaseId, COLLECTIONS.SECTIONS);
    await waitForCollection(databases, databaseId, COLLECTIONS.PROGRAMS);
    await waitForCollection(databases, databaseId, COLLECTIONS.CLASSES);

    const [sections, programs, classes] = await Promise.all([
        listAllDocuments(databases, databaseId, COLLECTIONS.SECTIONS),
        listAllDocuments(databases, databaseId, COLLECTIONS.PROGRAMS),
        listAllDocuments(databases, databaseId, COLLECTIONS.CLASSES),
    ]);

    const programById = new Map(
        programs.map((program) => [
            String(program?.$id || ""),
            {
                $id: String(program?.$id || ""),
                code: String(program?.code || "").trim(),
                name: String(program?.name || "").trim(),
            },
        ])
    );

    const classProgramIdsBySection = new Map();

    for (const cls of classes) {
        const sectionId = String(cls?.sectionId || "").trim();
        const programId = String(cls?.programId || "").trim();

        if (!sectionId || !programId) continue;

        if (!classProgramIdsBySection.has(sectionId)) {
            classProgramIdsBySection.set(sectionId, new Set());
        }

        classProgramIdsBySection.get(sectionId).add(programId);
    }

    let updatedCount = 0;
    const unresolved = [];

    for (const section of sections) {
        const sectionId = String(section?.$id || "").trim();
        const rawYearLevel = String(section?.yearLevel ?? "").trim();

        if (!sectionId || !rawYearLevel) continue;
        if (isResolvedYearLevel(rawYearLevel)) continue;

        const sectionProgramId = String(section?.programId || "").trim();
        const classProgramIds = classProgramIdsBySection.get(sectionId)
            ? Array.from(classProgramIdsBySection.get(sectionId))
            : [];

        const overridePrefix = normalizeSectionTrackPrefix(
            SECTION_TRACK_PREFIX_OVERRIDES[sectionId]
        );

        const sectionProgramPrefix = resolvePrefixFromProgram(
            programById.get(sectionProgramId)
        );

        const classProgramPrefix = resolvePrefixFromClassPrograms(
            classProgramIds,
            programById
        );

        const preferredPrefix =
            overridePrefix ||
            sectionProgramPrefix ||
            classProgramPrefix;

        const nextYearLevel = buildPrefixedYearLevel({
            rawYearLevel,
            preferredPrefix,
        });

        if (!nextYearLevel || !isResolvedYearLevel(nextYearLevel)) {
            unresolved.push({
                sectionId,
                currentYearLevel: rawYearLevel,
                sectionProgramId,
                classProgramIds,
            });
            continue;
        }

        await safeCall(
            () =>
                callDb(
                    databases,
                    "updateDocument",
                    {
                        databaseId,
                        collectionId: COLLECTIONS.SECTIONS,
                        documentId: sectionId,
                        data: {
                            yearLevel: nextYearLevel,
                        },
                    },
                    [
                        databaseId,
                        COLLECTIONS.SECTIONS,
                        sectionId,
                        {
                            yearLevel: nextYearLevel,
                        },
                    ]
                ),
            { label: `updateDocument ${COLLECTIONS.SECTIONS}.${sectionId}` }
        );

        updatedCount += 1;
        await delay(20);
    }

    if (unresolved.length > 0) {
        console.error("❌ Unresolved section yearLevel prefixes remain:");
        for (const item of unresolved) {
            console.error(
                ` - ${item.sectionId} | current=${item.currentYearLevel} | section.programId=${item.sectionProgramId || "—"} | class.programIds=${item.classProgramIds.join(", ") || "—"}`
            );
        }

        throw new Error(
            `Unresolved section yearLevel prefixes for ${unresolved.length} section(s). Add CS/IS values to SECTION_TRACK_PREFIX_OVERRIDES in migration ${id} and rerun.`
        );
    }

    console.log(`✅ Migration ${id} complete. Updated ${updatedCount} section(s).`);
}

export default { id, up, COLLECTIONS };