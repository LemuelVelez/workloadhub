import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { client, databases, users, DATABASE_ID, COLLECTIONS } from "./appwrite.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ../seeder relative to /database/script
const SEEDERS_DIR = path.resolve(__dirname, "../seeder");

function isSeederFile(name) {
    return /^\d+_.*\.(mjs|js)$/.test(name);
}

async function run() {
    const files = (await fs.readdir(SEEDERS_DIR))
        .filter(isSeederFile)
        .sort((a, b) => a.localeCompare(b, "en"));

    if (files.length === 0) {
        console.log("No seeder files found.");
        return;
    }

    console.log(`🌱 Running seeders against database: ${DATABASE_ID}`);
    console.log(`📂 ${SEEDERS_DIR}`);

    const ctx = { client, databases, users, databaseId: DATABASE_ID, COLLECTIONS };

    for (const file of files) {
        const full = path.join(SEEDERS_DIR, file);
        const mod = await import(pathToFileURL(full).href);

        const seedFn = mod.default;
        const seedId = mod.id ?? mod.default?.id ?? file;

        if (typeof seedFn !== "function") {
            console.log(`⚠️ Skipping ${file} (no default export function)`);
            continue;
        }

        console.log(`➡️  ${seedId}`);
        await seedFn(ctx);
        console.log(`✅ ${seedId}\n`);
    }

    console.log("🎉 All seeders completed.");
}

run().catch((err) => {
    console.error("❌ Seeder run failed:");
    console.error(err);
    process.exitCode = 1;
});
