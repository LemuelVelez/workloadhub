import {
    createUserWithInvite,
    deleteUserProfile,
    listDepartmentsLite,
    listUserProfiles,
    setUserActive,
    updateUserProfile,
} from "@/lib/admin-users"

export const adminApi = {
    departments: {
        listLite: listDepartmentsLite,
    },
    users: {
        list: listUserProfiles,

        // ✅ Create user with auto userId + invite email
        create: createUserWithInvite,

        update: updateUserProfile,
        setActive: setUserActive,
        remove: deleteUserProfile,
    },
}
