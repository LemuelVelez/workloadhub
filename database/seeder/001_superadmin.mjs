import { ID, Query, Permission, Role } from "node-appwrite";

export const id = "001_superadmin";

export default async function seedSuperadmin({ users, databases, databaseId, COLLECTIONS }) {
    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;
    const name = process.env.SUPERADMIN_NAME ?? "Super Admin";

    if (!email || !password) {
        throw new Error("Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD env vars.");
    }

    // 1) Ensure Appwrite Auth user exists
    let user = null;
    const list = await users.list([Query.equal("email", email), Query.limit(1)]);
    if (list?.total > 0) {
        user = list.users[0];
    } else {
        user = await users.create(ID.unique(), email, null, password, name);
    }

    // 2) Check if user profile document exists
    const existingProfiles = await databases.listDocuments(databaseId, COLLECTIONS.USER_PROFILES, [
        Query.equal("userId", user.$id),
        Query.limit(1),
    ]);

    const hasUser = list?.total > 0;
    const hasProfile = existingProfiles?.total > 0;

    // ✅ If everything already exists, SKIP
    if (hasUser && hasProfile) {
        console.log(`⏭️ Skipping ${id} (already seeded): ${email} (${user.$id})`);
        return;
    }

    // Otherwise, log what happened for clarity
    if (hasUser) {
        console.log(`ℹ️ Superadmin user already exists: ${email} (${user.$id})`);
    } else {
        console.log(`✅ Created superadmin auth user: ${email} (${user.$id})`);
    }

    if (hasProfile) {
        console.log("ℹ️ Superadmin profile already exists.");
        console.log(`⏭️ Skipping ${id} (already seeded)`);
        return;
    }

    const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
        Permission.read(Role.users()), // optional: allow authenticated users to read profiles
    ];

    await databases.createDocument(
        databaseId,
        COLLECTIONS.USER_PROFILES,
        ID.unique(),
        {
            userId: user.$id,
            email,
            name,
            role: "ADMIN",
            departmentId: null,
            isActive: true,
        },
        permissions
    );

    console.log("✅ Created superadmin profile document.");
}
