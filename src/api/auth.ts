import {
    confirmPasswordRecovery,
    getCurrentAccount,
    loginWithEmailPassword,
    logoutCurrentSession,
    requestPasswordRecovery,
} from "@/lib/auth";

export const authApi = {
    me: getCurrentAccount,
    login: loginWithEmailPassword,
    logout: logoutCurrentSession,
    forgotPassword: requestPasswordRecovery,
    resetPassword: confirmPasswordRecovery,
};
