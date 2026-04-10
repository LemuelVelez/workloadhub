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

export const id = "014_sync_section_term_metadata";
export const name = "Sync section semester and academic term labels from linked academic terms";

function normalizeValue(value) {
    const normalized = String(value ?? "").trim();
    return normalized || "";
}

function buildAcademicTermLabel(term) {
    const schoolYear = normalizeValue(term?.schoolYear);
    const semester = normalizeValue(term?.semester);

    if (schoolYear && semester) return `${schoolYear} • ${semester}`;
    return schoolYear || semester;
}

/**
 * @param {{ databases: import("node-appwrite").Databases, DATABASE_ID?: string, databaseId?: string, COLLECTIONS?: Record<string, string>, ATTR?: Record<string, any>, Query?: any }} ctx
 */
export async function up({ databases, DATABASE_ID, databaseId, COLLECTIONS, ATTR, Query }) {
    const resolvedDatabaseId = DATABASE_ID ?? databaseId;
    if (!resolvedDatabaseId) {
        throw new Error(`Migration ${id} requires DATABASE_ID or databaseId.`);
    }

    const sectionsCollectionId = COLLECTIONS?.SECTIONS || "sections";
    const termsCollectionId = COLLECTIONS?.ACADEMIC_TERMS || "academic_terms";
    const sectionsAttr = ATTR?.SECTIONS || {};
    const semesterKey = sectionsAttr.semester || "semester";
    const academicTermLabelKey = sectionsAttr.academicTermLabel || "academicTermLabel";

    console.log(`🔗 Syncing section term metadata on collection: ${sectionsCollectionId}`);

    await safeCall(
        () =>
            callDb(
                databases,
                "createStringAttribute",
                {
                    databaseId: resolvedDatabaseId,
                    collectionId: sectionsCollectionId,
                    key: semesterKey,
                    size: 100,
                    required: false,
                },
                [resolvedDatabaseId, sectionsCollectionId, semesterKey, 100, false]
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
                    key: academicTermLabelKey,
                    size: 255,
                    required: false,
                },
                [resolvedDatabaseId, sectionsCollectionId, academicTermLabelKey, 255, false]
            ),
        { onExists: "skip", label: "create sections.academicTermLabel attribute" }
    );

    await delay(1500);

    const termsResponse = await safeCall(
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

    const terms = termsResponse?.documents ?? [];
    const termMap = new Map(
        terms.map((term) => [normalizeValue(term?.$id), term]).filter(([key]) => Boolean(key))
    );

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

            const termId = normalizeValue(section?.termId);
            const relatedTerm = termId ? termMap.get(termId) : null;
            if (!relatedTerm) {
                skipped += 1;
                continue;
            }

            const nextSemester = normalizeValue(section?.[semesterKey]) || normalizeValue(relatedTerm?.semester);
            const nextAcademicTermLabel =
                normalizeValue(section?.[academicTermLabelKey]) || buildAcademicTermLabel(relatedTerm);

            const currentSemester = normalizeValue(section?.[semesterKey]);
            const currentAcademicTermLabel = normalizeValue(section?.[academicTermLabelKey]);

            if (currentSemester === nextSemester && currentAcademicTermLabel === nextAcademicTermLabel) {
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
                            [semesterKey]: nextSemester || null,
                            [academicTermLabelKey]: nextAcademicTermLabel || null,
                        },
                    },
                    [resolvedDatabaseId, sectionsCollectionId, section.$id, {
                        [semesterKey]: nextSemester || null,
                        [academicTermLabelKey]: nextAcademicTermLabel || null,
                    }]
                );
                updated += 1;
            } catch (error) {
                failed += 1;
                console.error(`❌ Failed to sync section term metadata for ${section?.$id}`, error);
            }
        }

        if (documents.length < limit) break;
        offset += documents.length;
    }

    console.log(`✅ Section term metadata migration finished. Checked: ${total}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

export async function down() {
    console.warn("↩️  Rollback is not implemented for section term metadata migration.");
}

export default { id, name, up, down };