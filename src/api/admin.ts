import {
    createUserProfile,
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
        create: createUserProfile,
        update: updateUserProfile,
        setActive: setUserActive,
        remove: deleteUserProfile,
    },
}
