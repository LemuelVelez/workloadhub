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

export const id = "011_link_sections_scope_fields";
export const name = "Link sections to semester and academic term scope fields";

function normalizeValue(value) {
    const normalized = String(value ?? "").trim();
    return normalized || null;
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
    const termsCollectionId = COLLECTIONS?.ACADEMIC_TERMS || "academic_terms";
    const sectionsAttr = ATTR?.SECTIONS || {};
    const sectionIndexes = INDEX?.SECTIONS || {};

    console.log(`🔗 Linking section scope fields on collection: ${sectionsCollectionId}`);

    await safeCall(
        () =>
            callDb(
                databases,
                "createStringAttribute",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: sectionsCollectionId,
                    key: sectionsAttr.semester || "semester",
                    size: 120,
                    required: false,
                    array: false,
                },
                [resolvedDatabaseId, sectionsCollectionId, sectionsAttr.semester || "semester", 120, false, undefined, false]
            ),
        { onExists: "skip", label: "create sections.semester attribute" }
    );

    await safeCall(
        () =>
            callDb(
                databases,
                "createStringAttribute",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: sectionsCollectionId,
                    key: sectionsAttr.academicTermLabel || "academicTermLabel",
                    size: 255,
                    required: false,
                    array: false,
                },
                [resolvedDatabaseId, sectionsCollectionId, sectionsAttr.academicTermLabel || "academicTermLabel", 255, false, undefined, false]
            ),
        { onExists: "skip", label: "create sections.academicTermLabel attribute" }
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
                    key: sectionIndexes.semester || "idx_sections_semester",
                    type: "key",
                    attributes: [sectionsAttr.semester || "semester"],
                },
                [resolvedDatabaseId, sectionsCollectionId, sectionIndexes.semester || "idx_sections_semester", "key", [sectionsAttr.semester || "semester"]]
            ),
        { onExists: "skip", label: "create sections.semester index" }
    );

    await safeCall(
        () =>
            callDb(
                databases,
                "createIndex",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: sectionsCollectionId,
                    key: sectionIndexes.academicTermLabel || "idx_sections_academic_term_label",
                    type: "fulltext",
                    attributes: [sectionsAttr.academicTermLabel || "academicTermLabel"],
                },
                [resolvedDatabaseId, sectionsCollectionId, sectionIndexes.academicTermLabel || "idx_sections_academic_term_label", "fulltext", [sectionsAttr.academicTermLabel || "academicTermLabel"]]
            ),
        { onExists: "skip", label: "create sections.academicTermLabel index" }
    );

    const termResponse = await safeCall(
        () =>
            callDb(
                databases,
                "listDocuments",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: termsCollectionId,
                    queries: [Query?.limit ? Query.limit(5000) : undefined].filter(Boolean),
                },
                [resolvedDatabaseId, termsCollectionId, [Query?.limit ? Query.limit(5000) : undefined].filter(Boolean)]
            ),
        { label: "list academic terms" }
    );

    const termMap = new Map(
        (termResponse?.documents ?? []).map((term) => {
            const schoolYear = normalizeValue(term?.schoolYear);
            const semester = normalizeValue(term?.semester);
            const academicTermLabel = schoolYear && semester ? `${schoolYear} • ${semester}` : schoolYear || semester || null;
            return [String(term?.$id ?? "").trim(), { semester, academicTermLabel }];
        })
    );

    let total = 0;
    let updated = 0;
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
            const termId = String(section?.termId ?? "").trim();
            const term = termMap.get(termId);

            const nextSemester = term?.semester || null;
            const nextAcademicTermLabel = term?.academicTermLabel || null;
            const currentSemester = normalizeValue(section?.[sectionsAttr.semester || "semester"]);
            const currentAcademicTermLabel = normalizeValue(section?.[sectionsAttr.academicTermLabel || "academicTermLabel"]);

            if (currentSemester === nextSemester && currentAcademicTermLabel === nextAcademicTermLabel) {
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
                            [sectionsAttr.semester || "semester"]: nextSemester,
                            [sectionsAttr.academicTermLabel || "academicTermLabel"]: nextAcademicTermLabel,
                        },
                    },
                    [resolvedDatabaseId, sectionsCollectionId, section.$id, {
                        [sectionsAttr.semester || "semester"]: nextSemester,
                        [sectionsAttr.academicTermLabel || "academicTermLabel"]: nextAcademicTermLabel,
                    }]
                );
                updated += 1;
            } catch (error) {
                failed += 1;
                console.error(`❌ Failed to backfill section ${section?.$id}`, error);
            }
        }

        if (documents.length < limit) break;
        offset += documents.length;
    }

    console.log(`✅ Section scope migration finished. Checked: ${total}, Updated: ${updated}, Failed: ${failed}`);
}

export async function down() {
    console.warn("↩️  Rollback is not implemented for section scope linking fields.");
}

export default { id, name, up, down };