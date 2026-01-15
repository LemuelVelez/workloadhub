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
 */

import { publicEnv, getServerEnv } from "./env"

const isBrowser = typeof window !== "undefined"

function assertServerOnly() {
    if (isBrowser) {
        throw new Error("[email] src/lib/email.ts was called in the browser. This is not allowed.")
    }
}

let _serverServicesPromise:
    | Promise<{
        sdk: any
        client: any
        messaging: any
        users: any
        providerId: string
    }>
    | null = null

async function getServerServices() {
    assertServerOnly()

    if (_serverServicesPromise) return _serverServicesPromise

    _serverServicesPromise = (async () => {
        const sdk = await import("node-appwrite")

        const { APPWRITE_API_KEY, APPWRITE_EMAIL_PROVIDER_ID } = getServerEnv()

        const client = new sdk.Client()
            .setEndpoint(publicEnv.APPWRITE_ENDPOINT)
            .setProject(publicEnv.APPWRITE_PROJECT_ID)
            .setKey(APPWRITE_API_KEY)

        const messaging = new sdk.Messaging(client)
        const users = new sdk.Users(client)

        return {
            sdk,
            client,
            messaging,
            users,
            providerId: APPWRITE_EMAIL_PROVIDER_ID,
        }
    })()

    return _serverServicesPromise
}

export type SendEmailParams = {
    subject: string
    content: string
    html?: boolean
    users?: string[]
    targets?: string[]
    topics?: string[]
    cc?: string[]
    bcc?: string[]
    attachments?: string[]
    scheduledAt?: string
    draft?: boolean
    messageId?: string
}

/**
 * Send an email using Appwrite Messaging.
 * Note: You must provide at least one of: users, targets, topics.
 */
export async function sendEmail(params: SendEmailParams) {
    assertServerOnly()

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
    } = params

    if (!subject?.trim()) throw new Error("[email] subject is required.")
    if (!content?.trim()) throw new Error("[email] content is required.")
    if (users.length === 0 && targets.length === 0 && topics.length === 0) {
        throw new Error("[email] Provide at least one recipient via users, targets, or topics.")
    }

    const { sdk, messaging } = await getServerServices()

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
    })
}

export type CreateEmailTargetParams = {
    userId: string
    email: string
    name?: string
    providerId?: string
    targetId?: string
}

/**
 * ✅ Creates an EMAIL target for a user and ties it to your SMTP Provider ID:
 * WORKLOADHUB_GMAIL_SMTP (from .env)
 */
export async function createEmailTargetForUser(params: CreateEmailTargetParams) {
    assertServerOnly()

    const { userId, email, name, providerId, targetId } = params
    if (!userId?.trim()) throw new Error("[email] userId is required.")
    if (!email?.trim()) throw new Error("[email] email is required.")

    const { sdk, users, providerId: defaultProviderId } = await getServerServices()

    const resolvedProviderId = providerId ?? defaultProviderId
    if (!resolvedProviderId?.trim()) {
        throw new Error("[email] Missing SMTP providerId. Set WORKLOADHUB_GMAIL_SMTP in your .env")
    }

    return await users.createTarget({
        userId: userId.trim(),
        targetId: targetId ?? sdk.ID.unique(),
        providerType: sdk.MessagingProviderType.Email,
        identifier: email.trim(),
        providerId: resolvedProviderId,
        name: name ?? "Primary Email",
    })
}

/**
 * Convenience helper:
 * - Creates an email target for a user (using your SMTP Provider)
 * - Sends an email to that target
 */
export async function createTargetAndSendEmail(opts: {
    userId: string
    email: string
    subject: string
    content: string
    html?: boolean
    name?: string
    providerId?: string
    cc?: string[]
    bcc?: string[]
    attachments?: string[]
    scheduledAt?: string
    draft?: boolean
}) {
    assertServerOnly()

    const target = await createEmailTargetForUser({
        userId: opts.userId,
        email: opts.email,
        name: opts.name,
        providerId: opts.providerId, // optional override
    })

    const targetId = (target as any)?.$id ?? (target as any)?.id
    if (!targetId) {
        throw new Error("[email] Failed to resolve targetId from createEmailTargetForUser().")
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
    })
}
