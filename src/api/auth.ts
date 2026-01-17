import {
    confirmPasswordRecovery,
    getCurrentAccount,
    loginWithEmailPassword,
    logoutCurrentSession,
    requestPasswordRecovery,
    updateMyPassword,
} from "@/lib/auth"

export const authApi = {
    me: getCurrentAccount,
    login: loginWithEmailPassword,
    logout: logoutCurrentSession,

    // ✅ Now uses Express TOKEN recovery (with Appwrite fallback)
    forgotPassword: requestPasswordRecovery,

    // ✅ Now supports BOTH token reset and Appwrite reset
    resetPassword: confirmPasswordRecovery,

    // ✅ required by first-login flow
    changePassword: updateMyPassword,
}
