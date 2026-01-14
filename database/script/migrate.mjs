import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import crypto from "node:crypto";

import { Permission, Role } from "node-appwrite";
import { databases, DATABASE_ID } from "./appwrite.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Folder: database/migration
const MIGRATIONS_DIR = path.resolve(__dirname, "../migration");

// Appwrite collection used to track applied migrations
const MIGRATIONS_COLLECTION = "schema_migrations";
const MIGRATION_ID_ATTR = "migrationId";

// IMPORTANT: Appwrite index key must be <= 36 chars.
const MIGRATION_INDEX_KEY = "idx_mig_mid_u"; // short + valid

// Only run files like: 001_initial_schema.js / 002_something.mjs
function isMigrationFile(name) {
    return /^\d+_.*\.(mjs|js)$/.test(name);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * node-appwrite has had versions where methods accept positional arguments
 * and versions where methods accept a single "params object".
 * This helper supports BOTH.
 */
async function callDb(methodName, paramsObject, paramsPositional = []) {
    const fn = databases?.[methodName];
    if (typeof fn !== "function") {
        throw new Error(`Databases SDK method not found: databases.${methodName}()`);
    }

    // Prefer object signature when it looks like the SDK expects it (length <= 1),
    // but fall back to positional if it fails.
    if (fn.length <= 1) {
        try {
            return await fn.call(databases, paramsObject);
        } catch {
            // fall through to positional
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

async function waitUntil(checkFn, { label, timeoutMs = 90000, startDelayMs = 200, maxDelayMs = 1500 } = {}) {
    const started = Date.now();
    let sleep = startDelayMs;
    let lastErr = null;

     
    while (true) {
        try {
            const ok = await checkFn();
            if (ok) return true;
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

async function waitForCollection(databaseId, collectionId) {
    await waitUntil(
        async () => {
            const col = await tryGet(() =>
                callDb("getCollection", { databaseId, collectionId }, [databaseId, collectionId])
            );
            return !!col;
        },
        { label: `collection ${collectionId}` }
    );
}

async function waitForAttributeAvailable(databaseId, collectionId, key) {
    await waitUntil(
        async () => {
            const attr = await tryGet(() =>
                callDb("getAttribute", { databaseId, collectionId, key }, [databaseId, collectionId, key])
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

async function waitForIndexAvailable(databaseId, collectionId, key) {
    await waitUntil(
        async () => {
            const idx = await tryGet(() =>
                callDb("getIndex", { databaseId, collectionId, key }, [databaseId, collectionId, key])
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

async function ensureMigrationsCollection() {
    const perms = [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
    ];

    const existing = await tryGet(() =>
        callDb(
            "getCollection",
            { databaseId: DATABASE_ID, collectionId: MIGRATIONS_COLLECTION },
            [DATABASE_ID, MIGRATIONS_COLLECTION]
        )
    );

    if (!existing) {
        // documentSecurity=false -> no per-document permissions needed
        await callDb(
            "createCollection",
            {
                databaseId: DATABASE_ID,
                collectionId: MIGRATIONS_COLLECTION,
                name: "Schema Migrations",
                permissions: perms,
                documentSecurity: false,
            },
            [DATABASE_ID, MIGRATIONS_COLLECTION, "Schema Migrations", perms, false]
        );
    }

    await waitForCollection(DATABASE_ID, MIGRATIONS_COLLECTION);

    // Ensure required attribute exists
    const attr = await tryGet(() =>
        callDb(
            "getAttribute",
            { databaseId: DATABASE_ID, collectionId: MIGRATIONS_COLLECTION, key: MIGRATION_ID_ATTR },
            [DATABASE_ID, MIGRATIONS_COLLECTION, MIGRATION_ID_ATTR]
        )
    );

    if (!attr) {
        await callDb(
            "createStringAttribute",
            {
                databaseId: DATABASE_ID,
                collectionId: MIGRATIONS_COLLECTION,
                key: MIGRATION_ID_ATTR,
                size: 128,
                required: true,
                default: null, // required attr cannot have default in Appwrite v1.8.x
                array: false,
            },
            [DATABASE_ID, MIGRATIONS_COLLECTION, MIGRATION_ID_ATTR, 128, true, null, false]
        );
    }

    await waitForAttributeAvailable(DATABASE_ID, MIGRATIONS_COLLECTION, MIGRATION_ID_ATTR);

    // Optional unique index on migrationId (short key <= 36)
    const idx = await tryGet(() =>
        callDb(
            "getIndex",
            { databaseId: DATABASE_ID, collectionId: MIGRATIONS_COLLECTION, key: MIGRATION_INDEX_KEY },
            [DATABASE_ID, MIGRATIONS_COLLECTION, MIGRATION_INDEX_KEY]
        )
    );

    if (!idx) {
        await callDb(
            "createIndex",
            {
                databaseId: DATABASE_ID,
                collectionId: MIGRATIONS_COLLECTION,
                key: MIGRATION_INDEX_KEY,
                type: "unique",
                attributes: [MIGRATION_ID_ATTR],
                orders: [],
            },
            [DATABASE_ID, MIGRATIONS_COLLECTION, MIGRATION_INDEX_KEY, "unique", [MIGRATION_ID_ATTR], []]
        );
    }

    await waitForIndexAvailable(DATABASE_ID, MIGRATIONS_COLLECTION, MIGRATION_INDEX_KEY);
}

function toMigrationDocId(migrationId) {
    // Appwrite document IDs: <=36 chars; valid chars a-z A-Z 0-9 . - _
    // Can't start with special char
    const safe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
    if (safe.test(migrationId) && migrationId.length <= 36) return migrationId;

    const h = crypto.createHash("sha1").update(migrationId).digest("hex");
    return `m${h.slice(0, 35)}`; // starts with alnum, length 36
}

async function hasApplied(migrationId) {
    const docId = toMigrationDocId(migrationId);
    const doc = await tryGet(() =>
        callDb(
            "getDocument",
            { databaseId: DATABASE_ID, collectionId: MIGRATIONS_COLLECTION, documentId: docId },
            [DATABASE_ID, MIGRATIONS_COLLECTION, docId]
        )
    );
    return !!doc;
}

async function markApplied(migrationId) {
    const docId = toMigrationDocId(migrationId);

    // Must be non-empty data
    const data = { [MIGRATION_ID_ATTR]: migrationId };

    await callDb(
        "createDocument",
        {
            databaseId: DATABASE_ID,
            collectionId: MIGRATIONS_COLLECTION,
            documentId: docId,
            data,
            permissions: [], // documentSecurity=false, safe
        },
        [DATABASE_ID, MIGRATIONS_COLLECTION, docId, data, []]
    );
}

async function run() {
    // Ensure folder exists
    try {
        await fs.access(MIGRATIONS_DIR);
    } catch {
        console.error(`❌ Migrations folder not found: ${MIGRATIONS_DIR}`);
        process.exitCode = 1;
        return;
    }

    const files = (await fs.readdir(MIGRATIONS_DIR))
        .filter(isMigrationFile)
        .sort((a, b) => a.localeCompare(b, "en"));

    if (files.length === 0) {
        console.log(`ℹ️ No migration files found in: ${MIGRATIONS_DIR}`);
        return;
    }

    console.log(`📦 Running migrations against DATABASE_ID: ${DATABASE_ID}`);
    console.log(`📂 Migrations directory: ${MIGRATIONS_DIR}\n`);

    // Ensure tracking collection exists (idempotent)
    await ensureMigrationsCollection();

    for (const file of files) {
        const fullPath = path.join(MIGRATIONS_DIR, file);

        // Dynamic import (ESM)
        const mod = await import(pathToFileURL(fullPath).href);

        const migrationId = mod.id ?? mod.default?.id ?? file;
        const up = mod.up ?? mod.default?.up;

        if (typeof up !== "function") {
            console.log(`⚠️ Skipping ${file}: no exported up() found.\n`);
            continue;
        }

        if (await hasApplied(migrationId)) {
            console.log(`⏭️  Skipping migration (already applied): ${migrationId}\n`);
            continue;
        }

        console.log(`➡️  Running migration: ${migrationId}`);
        await up({ databases, databaseId: DATABASE_ID });

        await markApplied(migrationId);

        console.log(`✅ Completed: ${migrationId}\n`);
    }

    console.log("🎉 All migrations finished.");
}

run().catch((err) => {
    console.error("❌ Migration run failed:");
    console.error(err?.message ?? err);
    if (err?.stack) console.error(err.stack);
    process.exitCode = 1;
});
