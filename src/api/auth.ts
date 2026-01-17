import {
    confirmPasswordRecovery,
    getCurrentAccount,
    loginWithEmailPassword,
    logoutCurrentSession,
    requestPasswordRecovery,
    updateMyPassword, // ✅ NEW
} from "@/lib/auth"

export const authApi = {
    me: getCurrentAccount,
    login: loginWithEmailPassword,
    logout: logoutCurrentSession,
    forgotPassword: requestPasswordRecovery,
    resetPassword: confirmPasswordRecovery,

    // ✅ NEW: required by first-login flow
    changePassword: updateMyPassword,
}
