import { Client, Databases, ID, Query } from "appwrite";
import { publicEnv } from "./env";

/**
 * Browser-safe Appwrite client (uses VITE_PUBLIC_* env only)
 * Use this for client-side Database access.
 */
export const appwriteClient = new Client()
    .setEndpoint(publicEnv.APPWRITE_ENDPOINT)
    .setProject(publicEnv.APPWRITE_PROJECT_ID);

export const databases = new Databases(appwriteClient);

export const DATABASE_ID = publicEnv.APPWRITE_DATABASE;

export { ID, Query };
