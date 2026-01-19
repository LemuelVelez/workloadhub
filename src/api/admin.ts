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

// ✅ NEW: Sections backend helpers
import {
    listSections,
    createSection,
    updateSection,
    deleteSection,
    listAcademicTermsLite,
} from "@/lib/admin-sections"

export const adminApi = {
    departments: {
        listLite: listDepartmentsLite,
    },

    // ✅ NEW: Academic terms (used by Sections)
    academicTerms: {
        listLite: listAcademicTermsLite,
    },

    // ✅ NEW: Sections API (uses Appwrite SECTIONS table)
    sections: {
        list: listSections,
        create: createSection,
        update: updateSection,
        remove: deleteSection,
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
