import { Permission, Role } from "node-appwrite";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Use >16383 for "TEXT-like" fields to reduce per-collection attribute-size pressure.
const TEXT_SIZE = 20000;

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
 * This helper supports BOTH without you having to care.
 */
async function callDb(databases, methodName, paramsObject, paramsPositional = []) {
    const fn = databases?.[methodName];
    if (typeof fn !== "function") {
        throw new Error(`Databases SDK method not found: databases.${methodName}()`);
    }

    // Prefer object signature when it looks like the SDK expects it (length <= 1)
    // but gracefully fall back to positional if that fails.
    if (fn.length <= 1) {
        try {
            return await fn.call(databases, paramsObject);
        } catch (e) {
            // Fall through to positional below
        }
    }

    return await fn.call(databases, ...paramsPositional);
}

/**
 * Small helper: try a GET call; if 404 => return null; otherwise rethrow.
 */
async function tryGet(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err?.code === 404) return null;
        return null;
    }
}

/**
 * Generic wait helper with backoff.
 */
async function waitUntil(checkFn, { label, timeoutMs = 120000, startDelayMs = 200, maxDelayMs = 2000 } = {}) {
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

/**
 * Wait until a collection exists.
 */
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

/**
 * Wait until an attribute exists AND status is "available".
 */
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

/**
 * Wait until an index exists AND status is "available".
 */
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

async function ensureInteger(databases, databaseId, collectionId, key, required, min = null, max = null, def = null, array = false) {
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
                    { databaseId, collectionId, key, required, min, max, default: normalizedDefault, array },
                    [databaseId, collectionId, key, required, min, max, normalizedDefault, array]
                ),
            { label: `createIntegerAttribute ${collectionId}.${key}` }
        );
    }

    await waitForAttributeAvailable(databases, databaseId, collectionId, key);
    await delay(40);
}

async function ensureFloat(databases, databaseId, collectionId, key, required, min = null, max = null, def = null, array = false) {
    const normalizedDefault = normalizeDefault(required, def);

    const existing = await tryGet(() =>
        callDb(databases, "getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
    );

    if (!existing) {
        await safeCall(
            () =>
                callDb(
                    databases,
                    "createFloatAttribute",
                    { databaseId, collectionId, key, required, min, max, default: normalizedDefault, array },
                    [databaseId, collectionId, key, required, min, max, normalizedDefault, array]
                ),
            { label: `createFloatAttribute ${collectionId}.${key}` }
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

    // Ensure referenced attributes are ready first
    for (const attrKey of attributes) {
        await waitForAttributeAvailable(databases, databaseId, collectionId, attrKey);
    }

    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
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
            break;
        } catch (err) {
            const isAttrNotAvail =
                err?.type === "attribute_not_available" ||
                (typeof err?.message === "string" && err.message.includes("Attribute not available"));
            if (!isAttrNotAvail || attempt === maxAttempts) throw err;
            await delay(250 * attempt);
        }
    }

    await waitForIndexAvailable(databases, databaseId, collectionId, key);
    await delay(60);
}

export const COLLECTIONS = {
    DEPARTMENTS: "departments",
    PROGRAMS: "programs",
    SUBJECTS: "subjects",
    ROOMS: "rooms",
    ACADEMIC_TERMS: "academic_terms",
    TIME_BLOCKS: "time_blocks",
    SYSTEM_POLICIES: "system_policies",
    SETTINGS: "settings",

    USER_PROFILES: "user_profiles",
    FACULTY_PROFILES: "faculty_profiles",

    SECTIONS: "sections",
    SCHEDULE_VERSIONS: "schedule_versions",
    CLASSES: "classes",
    CLASS_MEETINGS: "class_meetings",

    FACULTY_AVAILABILITY: "faculty_availability",
    CHANGE_REQUESTS: "change_requests",

    NOTIFICATIONS: "notifications",
    NOTIFICATION_RECIPIENTS: "notification_recipients",

    AUDIT_LOGS: "audit_logs",
};

export const id = "001_initial_schema";

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

    const permsLogs = [Permission.read(Role.users()), Permission.create(Role.users())];

    // -----------------------------
    // MASTER DATA
    // -----------------------------
    await ensureCollection(databases, databaseId, COLLECTIONS.DEPARTMENTS, "Departments", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.DEPARTMENTS, "code", 32, true);
    await ensureString(databases, databaseId, COLLECTIONS.DEPARTMENTS, "name", 128, true);
    await ensureBoolean(databases, databaseId, COLLECTIONS.DEPARTMENTS, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.DEPARTMENTS, "idx_departments_code_unique", "unique", ["code"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.DEPARTMENTS, "idx_departments_name_fulltext", "fulltext", ["name"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.PROGRAMS, "Programs/Courses", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.PROGRAMS, "departmentId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.PROGRAMS, "code", 32, true);
    await ensureString(databases, databaseId, COLLECTIONS.PROGRAMS, "name", 128, true);
    await ensureString(databases, databaseId, COLLECTIONS.PROGRAMS, "description", 512, false);
    await ensureBoolean(databases, databaseId, COLLECTIONS.PROGRAMS, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.PROGRAMS, "idx_programs_departmentId", "key", ["departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.PROGRAMS, "idx_programs_dept_code_unique", "unique", ["departmentId", "code"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.SUBJECTS, "Subjects", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.SUBJECTS, "departmentId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.SUBJECTS, "code", 32, true);
    await ensureString(databases, databaseId, COLLECTIONS.SUBJECTS, "title", 256, true);
    await ensureInteger(databases, databaseId, COLLECTIONS.SUBJECTS, "units", true, 0, 60, 0);
    await ensureFloat(databases, databaseId, COLLECTIONS.SUBJECTS, "lectureHours", true, 0, 80, 0);
    await ensureFloat(databases, databaseId, COLLECTIONS.SUBJECTS, "labHours", true, 0, 80, 0);
    await ensureFloat(databases, databaseId, COLLECTIONS.SUBJECTS, "totalHours", false, 0, 160, null);
    await ensureBoolean(databases, databaseId, COLLECTIONS.SUBJECTS, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.SUBJECTS, "idx_subjects_code_unique", "unique", ["code"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.SUBJECTS, "idx_subjects_departmentId", "key", ["departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.SUBJECTS, "idx_subjects_title_fulltext", "fulltext", ["title"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.ROOMS, "Rooms & Facilities", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.ROOMS, "code", 32, true);
    await ensureString(databases, databaseId, COLLECTIONS.ROOMS, "name", 128, false);
    await ensureString(databases, databaseId, COLLECTIONS.ROOMS, "building", 128, false);
    await ensureString(databases, databaseId, COLLECTIONS.ROOMS, "floor", 32, false);
    await ensureInteger(databases, databaseId, COLLECTIONS.ROOMS, "capacity", true, 0, 2000, 0);
    await ensureString(databases, databaseId, COLLECTIONS.ROOMS, "type", 16, true); // LECTURE | LAB | OTHER
    await ensureBoolean(databases, databaseId, COLLECTIONS.ROOMS, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.ROOMS, "idx_rooms_code_unique", "unique", ["code"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.ROOMS, "idx_rooms_type", "key", ["type"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "Academic Terms", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "schoolYear", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "semester", 16, true);
    await ensureDatetime(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "startDate", true);
    await ensureDatetime(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "endDate", true);
    await ensureBoolean(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "isActive", true, false);
    await ensureBoolean(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "isLocked", true, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "idx_terms_sy_sem_unique", "unique", ["schoolYear", "semester"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.ACADEMIC_TERMS, "idx_terms_isActive", "key", ["isActive"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "Time Blocks", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "dayOfWeek", 9, true);
    await ensureString(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "startTime", 5, true);
    await ensureString(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "endTime", 5, true);
    await ensureString(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "label", 64, false);
    await ensureBoolean(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.TIME_BLOCKS, "idx_timeblocks_term_day", "key", ["termId", "dayOfWeek"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "System Rules/Policies", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "termId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "key", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "value", TEXT_SIZE, true); // JSON string (TEXT)
    await ensureString(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "description", 512, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "idx_policies_term_key_unique", "unique", ["termId", "key"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.SYSTEM_POLICIES, "idx_policies_key", "key", ["key"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.SETTINGS, "Settings", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.SETTINGS, "key", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SETTINGS, "value", TEXT_SIZE, true); // JSON string (TEXT)
    await ensureString(databases, databaseId, COLLECTIONS.SETTINGS, "description", 512, false);
    await ensureString(databases, databaseId, COLLECTIONS.SETTINGS, "updatedBy", 64, false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.SETTINGS, "updatedAt", false);
    await ensureIndex(databases, databaseId, COLLECTIONS.SETTINGS, "idx_settings_key_unique", "unique", ["key"]);

    // -----------------------------
    // USERS / FACULTY
    // -----------------------------
    await ensureCollection(databases, databaseId, COLLECTIONS.USER_PROFILES, "User Profiles", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.USER_PROFILES, "userId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.USER_PROFILES, "email", 320, true);
    await ensureString(databases, databaseId, COLLECTIONS.USER_PROFILES, "name", 128, false);
    await ensureString(databases, databaseId, COLLECTIONS.USER_PROFILES, "role", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.USER_PROFILES, "departmentId", 64, false);
    await ensureBoolean(databases, databaseId, COLLECTIONS.USER_PROFILES, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.USER_PROFILES, "idx_profiles_userId_unique", "unique", ["userId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.USER_PROFILES, "idx_profiles_role", "key", ["role"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.USER_PROFILES, "idx_profiles_departmentId", "key", ["departmentId"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "Faculty Profiles", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "userId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "employeeNo", 32, false);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "departmentId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "rank", 64, false);
    await ensureInteger(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "maxUnits", false, 0, 100, null);
    await ensureFloat(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "maxHours", false, 0, 200, null);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "notes", 1024, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "idx_faculty_userId_unique", "unique", ["userId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.FACULTY_PROFILES, "idx_faculty_departmentId", "key", ["departmentId"]);

    // -----------------------------
    // SCHEDULING CORE
    // -----------------------------
    await ensureCollection(databases, databaseId, COLLECTIONS.SECTIONS, "Sections", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "departmentId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "programId", 64, false);
    await ensureInteger(databases, databaseId, COLLECTIONS.SECTIONS, "yearLevel", true, 1, 20, 1);
    await ensureString(databases, databaseId, COLLECTIONS.SECTIONS, "name", 64, true);
    await ensureInteger(databases, databaseId, COLLECTIONS.SECTIONS, "studentCount", false, 0, 5000, null);
    await ensureBoolean(databases, databaseId, COLLECTIONS.SECTIONS, "isActive", true, true);
    await ensureIndex(databases, databaseId, COLLECTIONS.SECTIONS, "idx_sections_term_department", "key", ["termId", "departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.SECTIONS, "idx_sections_term_name_unique", "unique", ["termId", "name"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "Schedule Versions", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "departmentId", 64, true);
    await ensureInteger(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "version", true, 1, 100000, 1);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "label", 128, false);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "status", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "createdBy", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "lockedBy", 64, false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "lockedAt", false);
    await ensureString(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "notes", 512, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "idx_versions_term_dept", "key", ["termId", "departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "idx_versions_unique", "unique", ["termId", "departmentId", "version"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.SCHEDULE_VERSIONS, "idx_versions_status", "key", ["status"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.CLASSES, "Classes (Offerings)", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "versionId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "departmentId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "programId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "sectionId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "subjectId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "facultyUserId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "classCode", 32, false);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "deliveryMode", 16, false);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "status", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASSES, "remarks", 512, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASSES, "idx_classes_versionId", "key", ["versionId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASSES, "idx_classes_term_dept", "key", ["termId", "departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASSES, "idx_classes_sectionId", "key", ["sectionId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASSES, "idx_classes_subjectId", "key", ["subjectId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASSES, "idx_classes_facultyUserId", "key", ["facultyUserId"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "Class Meetings (Schedule Lines)", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "versionId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "classId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "dayOfWeek", 9, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "startTime", 5, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "endTime", 5, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "roomId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "meetingType", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "notes", 256, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "idx_meetings_classId", "key", ["classId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "idx_meetings_versionId", "key", ["versionId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CLASS_MEETINGS, "idx_meetings_room_time", "key", ["roomId", "dayOfWeek", "startTime", "endTime"]);

    // -----------------------------
    // FACULTY AVAILABILITY + REQUESTS
    // -----------------------------
    await ensureCollection(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "Faculty Availability/Preferences", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "userId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "dayOfWeek", 9, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "startTime", 5, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "endTime", 5, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "preference", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "notes", 256, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "idx_availability_term_user", "key", ["termId", "userId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.FACULTY_AVAILABILITY, "idx_availability_day", "key", ["dayOfWeek"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "Schedule/Load Change Requests", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "termId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "departmentId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "requestedBy", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "classId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "meetingId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "type", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "details", TEXT_SIZE, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "status", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "reviewedBy", 64, false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "reviewedAt", false);
    await ensureString(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "resolutionNotes", TEXT_SIZE, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "idx_requests_term_dept", "key", ["termId", "departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "idx_requests_requestedBy", "key", ["requestedBy"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.CHANGE_REQUESTS, "idx_requests_status", "key", ["status"]);

    // -----------------------------
    // NOTIFICATIONS
    // -----------------------------
    await ensureCollection(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "Notifications", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "departmentId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "termId", 64, false);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "createdBy", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "type", 16, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "title", 128, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "message", TEXT_SIZE, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "link", 256, false);
    await ensureIndex(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "idx_notifications_departmentId", "key", ["departmentId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "idx_notifications_termId", "key", ["termId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.NOTIFICATIONS, "idx_notifications_type", "key", ["type"]);

    await ensureCollection(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "Notification Recipients", permsCRUD, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "notificationId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "userId", 64, true);
    await ensureBoolean(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "isRead", true, false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "readAt", false);
    await ensureIndex(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "idx_notifrec_user_isRead", "key", ["userId", "isRead"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.NOTIFICATION_RECIPIENTS, "idx_notifrec_unique", "unique", ["notificationId", "userId"]);

    // -----------------------------
    // AUDIT LOGS
    // -----------------------------
    await ensureCollection(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "Audit Logs", permsLogs, true);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "actorUserId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "action", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "entityType", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "entityId", 64, true);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "before", TEXT_SIZE, false);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "after", TEXT_SIZE, false);
    await ensureString(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "meta", TEXT_SIZE, false);
    await ensureDatetime(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "createdAt", false);
    await ensureIndex(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "idx_audit_actor", "key", ["actorUserId"]);
    await ensureIndex(databases, databaseId, COLLECTIONS.AUDIT_LOGS, "idx_audit_entity", "key", ["entityType", "entityId"]);

    console.log("✅ Migration 001_initial_schema complete.");
}

export default { id, up, COLLECTIONS };
