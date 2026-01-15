import { Storage, ID } from "appwrite";
import { publicEnv } from "./env";
import { appwriteClient } from "./db";

/**
 * Browser-safe Appwrite Storage helper (uses VITE_PUBLIC_* env only)
 */
export const storage = new Storage(appwriteClient);

export const BUCKET_ID = publicEnv.APPWRITE_BUCKET;

export { ID };
