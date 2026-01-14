import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Databases, Users } from "node-appwrite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from /database/script
const ROOT_DIR = path.resolve(__dirname, "../../");
const ENV_PATH = path.join(ROOT_DIR, ".env");

/**
 * Minimal .env loader (no dependency)
 * - Does not override existing process.env values
 * - Supports: KEY=value, KEY="value", KEY='value'
 * - Ignores empty lines and comments (# ...)
 */
function parseEnv(text) {
    const out = {};
    const lines = text.split(/\r?\n/);

    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;

        const eq = line.indexOf("=");
        if (eq === -1) continue;

        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();

        // strip surrounding quotes
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }

        out[key] = val;
    }
    return out;
}

async function loadDotEnv(filepath) {
    try {
        const content = await fs.readFile(filepath, "utf8");
        const parsed = parseEnv(content);

        for (const [k, v] of Object.entries(parsed)) {
            if (process.env[k] == null) process.env[k] = v;
        }
    } catch (err) {
        // Not fatal if file doesn't exist; but in your case it should exist
        // so we'll still log a helpful message.
        console.warn(`⚠️ Could not read .env at: ${filepath}`);
        // console.warn(err);
    }
}

// Load .env automatically for Node scripts
await loadDotEnv(ENV_PATH);

function required(name, value) {
    if (!value || String(value).trim() === "") {
        throw new Error(`Missing env var: ${name}`);
    }
    return value;
}

// Prefer private APPWRITE_* if present, else fall back to VITE_PUBLIC_APPWRITE_*
const env = {
    APPWRITE_ENDPOINT:
        process.env.APPWRITE_ENDPOINT ?? process.env.VITE_PUBLIC_APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID:
        process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_PUBLIC_APPWRITE_PROJECT_ID,
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY,
    APPWRITE_DATABASE:
        process.env.APPWRITE_DATABASE ?? process.env.VITE_PUBLIC_APPWRITE_DATABASE,
};

required("APPWRITE_ENDPOINT (or VITE_PUBLIC_APPWRITE_ENDPOINT)", env.APPWRITE_ENDPOINT);
required("APPWRITE_PROJECT_ID (or VITE_PUBLIC_APPWRITE_PROJECT_ID)", env.APPWRITE_PROJECT_ID);
required("APPWRITE_API_KEY", env.APPWRITE_API_KEY);
required("APPWRITE_DATABASE (or VITE_PUBLIC_APPWRITE_DATABASE)", env.APPWRITE_DATABASE);

export const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY);

export const databases = new Databases(client);
export const users = new Users(client);

export const DATABASE_ID = env.APPWRITE_DATABASE;

// Keep IDs centralized so scripts + frontend match
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
