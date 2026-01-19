import { Client, Databases, TablesDB, ID, Query } from "appwrite"
import { publicEnv } from "./env"

/**
 * Browser-safe Appwrite client (uses VITE_PUBLIC_* env only)
 * Use this for client-side Database access.
 */
export const appwriteClient = new Client()
    .setEndpoint(publicEnv.APPWRITE_ENDPOINT)
    .setProject(publicEnv.APPWRITE_PROJECT_ID)

// ✅ Keep Databases for backwards compatibility (old code)
export const databases = new Databases(appwriteClient)

// ✅ NEW: TablesDB (Appwrite 1.8+ replacement)
export const tablesDB = new TablesDB(appwriteClient)

export const DATABASE_ID = publicEnv.APPWRITE_DATABASE

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
} as const

export { ID, Query }
