/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-only email helpers using Appwrite Messaging (requires APPWRITE_API_KEY).
 *
 * IMPORTANT:
 * - Do NOT import/use this module from browser/client code.
 * - This file uses dynamic imports so it won't pull node-only deps into client bundles
 *   *unless you import it from client code*.
 *
 * Appwrite flow:
 * - Ensure your project has an Email provider configured in Appwrite Console (Messaging -> Providers).
 * - Send emails via Messaging.createEmail().
 * - If you need to send to a specific email address as a "target", create a user target first.
 */

import { publicEnv, getServerEnv } from "./env";

const isBrowser = typeof window !== "undefined";

function assertServerOnly() {
    if (isBrowser) {
        throw new Error("[email] src/lib/email.ts was called in the browser. This is not allowed.");
    }
}

let _serverServicesPromise:
    | Promise<{
        sdk: any;
        client: any;
        messaging: any;
        users: any;
    }>
    | null = null;

async function getServerServices() {
    assertServerOnly();

    if (_serverServicesPromise) return _serverServicesPromise;

    _serverServicesPromise = (async () => {
        const sdk = await import("node-appwrite");

        const { APPWRITE_API_KEY } = getServerEnv();

        const client = new sdk.Client()
            .setEndpoint(publicEnv.APPWRITE_ENDPOINT)
            .setProject(publicEnv.APPWRITE_PROJECT_ID)
            .setKey(APPWRITE_API_KEY);

        const messaging = new sdk.Messaging(client);
        const users = new sdk.Users(client);

        return { sdk, client, messaging, users };
    })();

    return _serverServicesPromise;
}

export type SendEmailParams = {
    subject: string;
    content: string;

    /**
     * If true, Appwrite will treat `content` as HTML.
     * Default: true
     */
    html?: boolean;

    /**
     * Send to one or more user IDs (Appwrite will deliver to their email targets).
     */
    users?: string[];

    /**
     * Send to one or more target IDs (explicit targets).
     */
    targets?: string[];

    /**
     * Optional topic IDs.
     */
    topics?: string[];

    /**
     * CC/BCC are target IDs.
     */
    cc?: string[];
    bcc?: string[];

    /**
     * Attachments must be "<BUCKET_ID>:<FILE_ID>" strings.
     */
    attachments?: string[];

    /**
     * ISO8601 datetime string in the future (optional).
     */
    scheduledAt?: string;

    /**
     * Create as draft (optional).
     */
    draft?: boolean;

    /**
     * Optional custom messageId; if not provided, ID.unique() is used.
     */
    messageId?: string;
};

/**
 * Send an email using Appwrite Messaging.
 * Note: You must provide at least one of: users, targets, topics.
 */
export async function sendEmail(params: SendEmailParams) {
    assertServerOnly();

    const {
        subject,
        content,
        html = true,
        users = [],
        targets = [],
        topics = [],
        cc = [],
        bcc = [],
        attachments = [],
        scheduledAt,
        draft = false,
        messageId,
    } = params;

    if (!subject?.trim()) throw new Error("[email] subject is required.");
    if (!content?.trim()) throw new Error("[email] content is required.");

    if (users.length === 0 && targets.length === 0 && topics.length === 0) {
        throw new Error("[email] Provide at least one recipient via users, targets, or topics.");
    }

    const { sdk, messaging } = await getServerServices();

    return await messaging.createEmail({
        messageId: messageId ?? sdk.ID.unique(),
        subject,
        content,
        topics,
        users,
        targets,
        cc,
        bcc,
        attachments,
        draft,
        html,
        scheduledAt: scheduledAt ?? undefined,
    });
}

export type CreateEmailTargetParams = {
    userId: string;

    /**
     * Target identifier for email targets = the email address.
     */
    email: string;

    /**
     * Optional human-readable target name.
     * Example: "Work Email"
     */
    name?: string;

    /**
     * Optional providerId override (if you have multiple email providers).
     */
    providerId?: string;

    /**
     * Optional custom targetId; if not provided, ID.unique() is used.
     */
    targetId?: string;
};

/**
 * Creates an EMAIL target for a user (so you can send Messaging emails to that address via targetId).
 */
export async function createEmailTargetForUser(params: CreateEmailTargetParams) {
    assertServerOnly();

    const { userId, email, name, providerId, targetId } = params;
    if (!userId?.trim()) throw new Error("[email] userId is required.");
    if (!email?.trim()) throw new Error("[email] email is required.");

    const { sdk, users } = await getServerServices();

    return await users.createTarget({
        userId,
        targetId: targetId ?? sdk.ID.unique(),
        providerType: sdk.MessagingProviderType.Email,
        identifier: email.trim(),
        providerId: providerId ?? undefined,
        name: name ?? undefined,
    });
}

/**
 * Convenience helper:
 * - Creates an email target for a user (if needed),
 * - Sends an email to that target.
 *
 * If you already have a targetId, just call sendEmail({ targets:[targetId], ... }).
 */
export async function createTargetAndSendEmail(opts: {
    userId: string;
    email: string;
    subject: string;
    content: string;
    html?: boolean;
    name?: string;
    providerId?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: string[];
    scheduledAt?: string;
    draft?: boolean;
}) {
    assertServerOnly();

    const target = await createEmailTargetForUser({
        userId: opts.userId,
        email: opts.email,
        name: opts.name,
        providerId: opts.providerId,
    });

    const targetId = (target as any)?.$id ?? (target as any)?.id;
    if (!targetId) {
        throw new Error("[email] Failed to resolve targetId from createEmailTargetForUser().");
    }

    return await sendEmail({
        subject: opts.subject,
        content: opts.content,
        html: opts.html ?? true,
        targets: [targetId],
        cc: opts.cc ?? [],
        bcc: opts.bcc ?? [],
        attachments: opts.attachments ?? [],
        scheduledAt: opts.scheduledAt,
        draft: opts.draft ?? false,
    });
}
