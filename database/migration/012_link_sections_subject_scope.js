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

export const id = "012_link_sections_subject_scope";
export const name = "Link sections to matching subject scope";

const SUBJECT_PROGRAM_KEYS = ["programId", "program", "program_id", "programID"];
const SUBJECT_PROGRAM_ARRAY_KEYS = ["programIds", "program_ids"];
const SUBJECT_YEAR_LEVEL_KEYS = ["yearLevel", "sectionYearLevel", "sectionYear", "year_level"];
const SUBJECT_YEAR_LEVEL_ARRAY_KEYS = ["yearLevels", "year_levels"];
const SUBJECT_SEMESTER_KEYS = ["semester", "semesterLabel", "termSemester", "termSem"];

function normalizeValue(value) {
    const normalized = String(value ?? "").trim();
    return normalized || null;
}

function normalizeSectionYearLevelValue(value) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");
}

function extractSectionYearNumber(value) {
    const normalized = normalizeSectionYearLevelValue(value);
    if (!normalized) return "";

    const direct = normalized.match(/^([1-9]\d*)$/);
    if (direct) return direct[1];

    const prefixed = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/);
    if (prefixed) return prefixed[1];

    const trailing = normalized.match(/(?:^|[\s-])([1-9]\d*)$/);
    return trailing?.[1] ?? "";
}

function readFirstStringValue(source, keys) {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}

function readStringArrayValues(source, arrayKeys, fallbackStringKeys = []) {
    const values = [];

    for (const key of arrayKeys) {
        const value = source?.[key];

        if (Array.isArray(value)) {
            for (const item of value) {
                const normalized = normalizeValue(item);
                if (normalized) values.push(normalized);
            }
            continue;
        }

        if (typeof value === "string" && value.trim()) {
            const parts = value.includes(",") ? value.split(",") : [value];
            for (const part of parts) {
                const normalized = normalizeValue(part);
                if (normalized) values.push(normalized);
            }
        }
    }

    if (values.length === 0) {
        for (const key of fallbackStringKeys) {
            const normalized = normalizeValue(source?.[key]);
            if (normalized) values.push(normalized);
        }
    }

    return Array.from(new Set(values));
}

function resolveSubjectProgramIds(source) {
    return readStringArrayValues(source, SUBJECT_PROGRAM_ARRAY_KEYS, SUBJECT_PROGRAM_KEYS);
}

function resolveSubjectYearLevels(source) {
    return Array.from(
        new Set(
            readStringArrayValues(source, SUBJECT_YEAR_LEVEL_ARRAY_KEYS, SUBJECT_YEAR_LEVEL_KEYS)
                .map((value) => extractSectionYearNumber(value) || normalizeSectionYearLevelValue(value))
                .filter(Boolean)
        )
    );
}

function resolveSubjectSemester(source) {
    return readFirstStringValue(source, SUBJECT_SEMESTER_KEYS);
}

function resolveSubjectTermId(source) {
    return normalizeValue(source?.termId);
}

function matchesSectionScope(section, subject) {
    const sectionDepartmentId = normalizeValue(section?.departmentId);
    const sectionProgramId = normalizeValue(section?.programId);
    const sectionTermId = normalizeValue(section?.termId);
    const sectionSemester = normalizeValue(section?.semester);
    const sectionYearNumber = extractSectionYearNumber(section?.yearLevel);

    const subjectDepartmentId = normalizeValue(subject?.departmentId);
    if (sectionDepartmentId && subjectDepartmentId && sectionDepartmentId !== subjectDepartmentId) {
        return false;
    }

    const subjectTermId = resolveSubjectTermId(subject);
    if (sectionTermId && subjectTermId && sectionTermId !== subjectTermId) {
        return false;
    }

    const subjectProgramIds = resolveSubjectProgramIds(subject);
    if (sectionProgramId && subjectProgramIds.length > 0 && !subjectProgramIds.includes(sectionProgramId)) {
        return false;
    }

    const subjectYearLevels = resolveSubjectYearLevels(subject);
    if (sectionYearNumber && subjectYearLevels.length > 0 && !subjectYearLevels.includes(sectionYearNumber)) {
        return false;
    }

    const subjectSemester = resolveSubjectSemester(subject);
    if (sectionSemester && subjectSemester && sectionSemester !== subjectSemester) {
        return false;
    }

    return true;
}

/**
 * @param {{ databases: import("node-appwrite").Databases, DATABASE_ID?: string, databaseId?: string, COLLECTIONS?: Record<string, string>, ATTR?: Record<string, any>, INDEX?: Record<string, any>, Query?: any }} ctx
 */
export async function up({ databases, DATABASE_ID, databaseId, COLLECTIONS, ATTR, INDEX, Query }) {
    const resolvedDatabaseId = DATABASE_ID ?? databaseId;
    if (!resolvedDatabaseId) {
        throw new Error(`Migration ${id} requires DATABASE_ID or databaseId.`);
    }

    const sectionsCollectionId = COLLECTIONS?.SECTIONS || "sections";
    const subjectsCollectionId = COLLECTIONS?.SUBJECTS || "subjects";
    const sectionsAttr = ATTR?.SECTIONS || {};
    const sectionIndexes = INDEX?.SECTIONS || {};

    console.log(`🔗 Linking section subject scope on collection: ${sectionsCollectionId}`);

    await safeCall(
        () =>
            callDb(
                databases,
                "createStringAttribute",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: sectionsCollectionId,
                    key: sectionsAttr.subjectId || "subjectId",
                    size: 255,
                    required: false,
                    array: false,
                },
                [resolvedDatabaseId, sectionsCollectionId, sectionsAttr.subjectId || "subjectId", 255, false, undefined, false]
            ),
        { onExists: "skip", label: "create sections.subjectId attribute" }
    );

    await delay(1500);

    await safeCall(
        () =>
            callDb(
                databases,
                "createIndex",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: sectionsCollectionId,
                    key: sectionIndexes.subjectId || "idx_sections_subjectId",
                    type: "key",
                    attributes: [sectionsAttr.subjectId || "subjectId"],
                },
                [resolvedDatabaseId, sectionsCollectionId, sectionIndexes.subjectId || "idx_sections_subjectId", "key", [sectionsAttr.subjectId || "subjectId"]]
            ),
        { onExists: "skip", label: "create sections.subjectId index" }
    );

    const subjectResponse = await safeCall(
        () =>
            callDb(
                databases,
                "listDocuments",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: subjectsCollectionId,
                    queries: [Query?.limit ? Query.limit(5000) : undefined].filter(Boolean),
                },
                [resolvedDatabaseId, subjectsCollectionId, [Query?.limit ? Query.limit(5000) : undefined].filter(Boolean)]
            ),
        { label: "list subjects" }
    );

    const subjects = subjectResponse?.documents ?? [];

    let total = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let offset = 0;
    const limit = 100;

    while (true) {
        const response = await safeCall(
            () =>
                callDb(
                    databases,
                    "listDocuments",
                    {
                        databaseId: resolvedDatabaseId,
                        collectionId: sectionsCollectionId,
                        queries: [
                            Query?.limit ? Query.limit(limit) : undefined,
                            Query?.offset ? Query.offset(offset) : undefined,
                        ].filter(Boolean),
                    },
                    [resolvedDatabaseId, sectionsCollectionId, [
                        Query?.limit ? Query.limit(limit) : undefined,
                        Query?.offset ? Query.offset(offset) : undefined,
                    ].filter(Boolean)]
                ),
            { label: `list sections batch ${offset}` }
        );

        const documents = response?.documents ?? [];
        if (documents.length === 0) break;

        for (const section of documents) {
            total += 1;

            const currentSubjectId = normalizeValue(section?.[sectionsAttr.subjectId || "subjectId"]);
            if (currentSubjectId) {
                skipped += 1;
                continue;
            }

            const matches = subjects.filter((subject) => matchesSectionScope(section, subject));
            if (matches.length !== 1) {
                skipped += 1;
                continue;
            }

            const nextSubjectId = normalizeValue(matches[0]?.$id);
            if (!nextSubjectId) {
                skipped += 1;
                continue;
            }

            try {
                await callDb(
                    databases,
                    "updateDocument",
                    {
                        databaseId: resolvedDatabaseId,
                        collectionId: sectionsCollectionId,
                        documentId: section.$id,
                        data: {
                            [sectionsAttr.subjectId || "subjectId"]: nextSubjectId,
                        },
                    },
                    [resolvedDatabaseId, sectionsCollectionId, section.$id, {
                        [sectionsAttr.subjectId || "subjectId"]: nextSubjectId,
                    }]
                );
                updated += 1;
            } catch (error) {
                failed += 1;
                console.error(`❌ Failed to backfill section subject for ${section?.$id}`, error);
            }
        }

        if (documents.length < limit) break;
        offset += documents.length;
    }

    console.log(`✅ Section subject scope migration finished. Checked: ${total}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

export async function down() {
    console.warn("↩️  Rollback is not implemented for section subject scope linking.");
}

export default { id, name, up, down };