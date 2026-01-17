import {
    createUserWithInvite,
    deleteUserProfile,
    listDepartmentsLite,
    listUserProfiles,
    resendUserCredentials,
    setUserActive,
    updateUserProfile,
} from "@/lib/admin-users"

// ✅ NEW: First-login status helper from Appwrite table
import { getFirstLoginStatusMap } from "@/lib/first-login"

export const adminApi = {
    departments: {
        listLite: listDepartmentsLite,
    },
    users: {
        list: listUserProfiles,

        // ✅ Create user with auto userId + invite email
        create: createUserWithInvite,

        update: updateUserProfile,

        // ✅ NOW updates BOTH:
        // - USER_PROFILES.isActive
        // - Appwrite Auth user status (login blocked)
        setActive: setUserActive,

        // ✅ NOW deletes BOTH:
        // - USER_PROFILES row
        // - Appwrite Auth User
        remove: deleteUserProfile,

        // ✅ resend credentials email + reset temp password
        resendCredentials: resendUserCredentials,
    },

    // ✅ NEW: fetch first-login status from Appwrite FIRST_LOGIN_USERS table
    firstLoginUsers: {
        statusMap: getFirstLoginStatusMap,
    },
}
