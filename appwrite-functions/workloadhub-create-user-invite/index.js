const sdk = require("node-appwrite")

function json(res, statusCode, body) {
    if (typeof res.json === "function") {
        return res.json(body, statusCode)
    }
    if (typeof res.send === "function") {
        return res.send(JSON.stringify(body), statusCode, {
            "content-type": "application/json",
        })
    }
    return body
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, "&#096;")
}

function generateTempPassword(length = 14) {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    const lower = "abcdefghijkmnopqrstuvwxyz"
    const nums = "23456789"
    const sym = "!@#$%^&*_-+=?"

    const all = upper + lower + nums + sym
    const pick = (set) => set[Math.floor(Math.random() * set.length)]

    const base = [
        pick(upper),
        pick(lower),
        pick(nums),
        pick(sym),
        ...Array.from({ length: Math.max(8, length) - 4 }, () => pick(all)),
    ]

    for (let i = base.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[base[i], base[j]] = [base[j], base[i]]
    }

    return base.join("")
}

function parseBody(req) {
    const raw =
        req?.body ??
        req?.payload ??
        req?.variables?.APPWRITE_FUNCTION_DATA ??
        process.env.APPWRITE_FUNCTION_DATA ??
        "{}"

    if (typeof raw === "object") return raw
    if (typeof raw !== "string") return {}
    try {
        return JSON.parse(raw || "{}")
    } catch {
        return {}
    }
}

async function safeGetUserById(users, userId) {
    if (!userId) return null
    try {
        return await users.get(userId)
    } catch {
        return null
    }
}

async function safeFindUserByEmail(users, email, log) {
    if (!email) return null

    // ✅ Object-style (new SDK)
    try {
        const r = await users.list({
            queries: [sdk.Query.equal("email", email), sdk.Query.limit(1)],
        })
        return r?.users?.[0] || null
    } catch (e1) {
        // ✅ Positional-style fallback (older SDK)
        try {
            const r = await users.list([sdk.Query.equal("email", email), sdk.Query.limit(1)])
            return r?.users?.[0] || null
        } catch (e2) {
            log("safeFindUserByEmail failed: " + (e2?.message || e2))
            return null
        }
    }
}

async function safeUpdatePassword(users, userId, password) {
    if (!userId || !password) return false

    try {
        await users.updatePassword({ userId, password })
        return true
    } catch {
        // fallback positional
        try {
            await users.updatePassword(userId, password)
            return true
        } catch {
            return false
        }
    }
}

async function safeUpdatePrefs(users, userId, prefs, log) {
    if (!userId) return false

    try {
        await users.updatePrefs({ userId, prefs })
        return true
    } catch {
        try {
            await users.updatePrefs(userId, prefs)
            return true
        } catch (e) {
            log("updatePrefs skipped: " + (e?.message || e))
            return false
        }
    }
}

/**
 * ✅ Appwrite Function
 * - Creates an AUTH user (create mode)
 * - OR resets password + resends email (resend mode)
 * - Creates Email Target (WorkloadHub_Gmail_SMTP providerId)
 * - Sends credentials via Messaging.createEmail()
 */
module.exports = async ({ req, res, log, error }) => {
    try {
        const input = parseBody(req)

        const email = String(input?.email || "")
            .trim()
            .toLowerCase()

        const name =
            typeof input?.name === "string" && input.name.trim()
                ? input.name.trim()
                : undefined

        const resend = Boolean(input?.resend)
        const inputUserId = String(input?.userId || "").trim()

        if (!email) {
            return json(res, 400, { ok: false, message: "Email is required." })
        }

        const endpoint =
            process.env.VITE_PUBLIC_APPWRITE_ENDPOINT ||
            process.env.APPWRITE_FUNCTION_ENDPOINT

        const projectId =
            process.env.VITE_PUBLIC_APPWRITE_PROJECT_ID ||
            process.env.APPWRITE_FUNCTION_PROJECT_ID

        const apiKey = process.env.APPWRITE_API_KEY

        const providerId =
            process.env.WorkloadHub_Gmail_SMTP ||
            process.env.APPWRITE_EMAIL_PROVIDER_ID

        const appOrigin =
            process.env.VITE_PUBLIC_APP_ORIGIN ||
            process.env.APP_ORIGIN ||
            ""

        if (!endpoint || !projectId || !apiKey) {
            return json(res, 500, {
                ok: false,
                message: "Missing Appwrite env vars (endpoint/projectId/apiKey).",
            })
        }

        const client = new sdk.Client()
            .setEndpoint(endpoint)
            .setProject(projectId)
            .setKey(apiKey)

        const users = new sdk.Users(client)
        const messaging = new sdk.Messaging(client)

        // ✅ Detect existing user (by userId first, then by email)
        let existingUser = await safeGetUserById(users, inputUserId)
        if (!existingUser) {
            existingUser = await safeFindUserByEmail(users, email, log)
        }

        let resolvedUserId = null
        let tempPassword = null
        let action = "created"

        if (existingUser) {
            // ✅ RESEND MODE: reset password + resend email
            resolvedUserId = existingUser?.$id || existingUser?.id || null
            tempPassword = generateTempPassword(14)
            action = "resent"

            const ok = await safeUpdatePassword(users, resolvedUserId, tempPassword)
            if (!ok) {
                return json(res, 500, {
                    ok: false,
                    message: "Failed to reset user password for resend.",
                })
            }

            // ✅ Force must-change-password again (best-effort)
            await safeUpdatePrefs(
                users,
                resolvedUserId,
                {
                    mustChangePassword: true,
                    isVerified: false,
                    credentialsResentAt: new Date().toISOString(),
                },
                log
            )
        } else {
            // ✅ If resend requested but no user exists => error
            if (resend) {
                return json(res, 404, {
                    ok: false,
                    message: "User not found. Cannot resend credentials.",
                })
            }

            // ✅ CREATE MODE: create new user + send credentials
            const newUserId = sdk.ID.unique()
            tempPassword = generateTempPassword(14)

            let createdUser = null
            try {
                createdUser = await users.create({
                    userId: newUserId,
                    email,
                    password: tempPassword,
                    name,
                })
            } catch {
                // older positional style: (userId, email, phone, password, name)
                createdUser = await users.create(newUserId, email, undefined, tempPassword, name)
            }

            resolvedUserId = createdUser?.$id || createdUser?.id || newUserId

            // ✅ Initialize prefs (best-effort)
            await safeUpdatePrefs(
                users,
                resolvedUserId,
                {
                    mustChangePassword: true,
                    isVerified: false,
                    createdByAdmin: true,
                    createdAt: new Date().toISOString(),
                },
                log
            )
        }

        // ✅ Create email target with your Gmail SMTP providerId (best-effort)
        let targetId = null
        try {
            const target = await users.createTarget({
                userId: resolvedUserId,
                targetId: sdk.ID.unique(),
                providerType: sdk.MessagingProviderType.Email,
                identifier: email,
                providerId: providerId || undefined,
                name: "WorkloadHub Email",
            })

            targetId = target?.$id || target?.id || null
        } catch (e) {
            log("createTarget skipped: " + (e?.message || "unknown"))
        }

        const loginUrl = appOrigin
            ? `${String(appOrigin).replace(/\/$/, "")}/auth/login`
            : ""

        const subject =
            action === "resent"
                ? "Your WorkloadHub Credentials (Updated)"
                : "Your WorkloadHub Account Credentials"

        const content = `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <p>Hello${name ? " " + escapeHtml(name) : ""},</p>

              <p>
                Your <b>WorkloadHub</b> ${action === "resent"
                ? "credentials have been updated"
                : "account has been created"
            }.
              </p>

              <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
                <p style="margin: 0;"><b>Login Email:</b> ${escapeHtml(email)}</p>
                <p style="margin: 0;"><b>Temporary Password:</b> ${escapeHtml(tempPassword)}</p>
              </div>

              ${loginUrl
                ? `<p style="margin-top: 12px;">
                           <b>Login here:</b> <a href="${escapeAttr(loginUrl)}">${escapeHtml(
                    loginUrl
                )}</a>
                         </p>`
                : ""
            }

              <p style="margin-top: 12px;">
                ✅ For security, you will be required to <b>change your password on first login</b>.
              </p>

              <p style="margin-top: 16px; color: #6b7280; font-size: 12px;">
                If you did not expect this email, please ignore it and contact your administrator.
              </p>
            </div>
        `

        const emailPayload = {
            messageId: sdk.ID.unique(),
            subject,
            content,
            html: true,
            // ✅ Prefer targets when available (forces your provider)
            targets: targetId ? [targetId] : [],
            users: targetId ? [] : [resolvedUserId],
        }

        await messaging.createEmail(emailPayload)

        return json(res, 200, {
            ok: true,
            action,
            userId: String(resolvedUserId),
            email,
            message: action === "resent" ? "Credentials resent." : "User created.",
        })
    } catch (e) {
        error(String(e?.message || e))
        return json(res, 500, { ok: false, message: e?.message || "Function failed." })
    }
}
