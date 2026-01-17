/**
 * Single source of truth for Appwrite schema:
 * - Collection IDs
 * - Attribute keys
 * - Index keys (names used in migrations)
 * - Lightweight TypeScript document shapes for app code
 *
 * Keep this file "shared + safe":
 * - No node-only imports
 * - No env access
 * - No SDK calls
 */

export const SCHEMA_MIGRATION_ID = "002_first_login_users" as const;

/**
 * Appwrite Collection IDs (must match migration IDs exactly)
 */
export const COLLECTIONS = {
    DEPARTMENTS: "departments",
    PROGRAMS: "programs",
    SUBJECTS: "subjects",
    ROOMS: "rooms",
    ACADEMIC_TERMS: "academic_terms",
    TIME_BLOCKS: "time_blocks",
    SYSTEM_POLICIES: "system_policies",
    SETTINGS: "settings",

    USER_PROFILES: "user_profiles",
    FACULTY_PROFILES: "faculty_profiles",

    // ✅ NEW: first-time user gate table
    FIRST_LOGIN_USERS: "first_login_users",

    SECTIONS: "sections",
    SCHEDULE_VERSIONS: "schedule_versions",
    CLASSES: "classes",
    CLASS_MEETINGS: "class_meetings",

    FACULTY_AVAILABILITY: "faculty_availability",
    CHANGE_REQUESTS: "change_requests",

    NOTIFICATIONS: "notifications",
    NOTIFICATION_RECIPIENTS: "notification_recipients",

    AUDIT_LOGS: "audit_logs",
} as const;

export type CollectionId = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/**
 * Attribute keys per collection (helps prevent typos in Query.equal, etc.)
 */
export const ATTR = {
    DEPARTMENTS: {
        code: "code",
        name: "name",
        isActive: "isActive",
    },
    PROGRAMS: {
        departmentId: "departmentId",
        code: "code",
        name: "name",
        description: "description",
        isActive: "isActive",
    },
    SUBJECTS: {
        departmentId: "departmentId",
        code: "code",
        title: "title",
        units: "units",
        lectureHours: "lectureHours",
        labHours: "labHours",
        totalHours: "totalHours",
        isActive: "isActive",
    },
    ROOMS: {
        code: "code",
        name: "name",
        building: "building",
        floor: "floor",
        capacity: "capacity",
        type: "type",
        isActive: "isActive",
    },
    ACADEMIC_TERMS: {
        schoolYear: "schoolYear",
        semester: "semester",
        startDate: "startDate",
        endDate: "endDate",
        isActive: "isActive",
        isLocked: "isLocked",
    },
    TIME_BLOCKS: {
        termId: "termId",
        dayOfWeek: "dayOfWeek",
        startTime: "startTime",
        endTime: "endTime",
        label: "label",
        isActive: "isActive",
    },
    SYSTEM_POLICIES: {
        termId: "termId",
        key: "key",
        value: "value",
        description: "description",
    },
    SETTINGS: {
        key: "key",
        value: "value",
        description: "description",
        updatedBy: "updatedBy",
        updatedAt: "updatedAt",
    },

    USER_PROFILES: {
        userId: "userId",
        email: "email",
        name: "name",
        role: "role",
        departmentId: "departmentId",
        isActive: "isActive",
    },
    FACULTY_PROFILES: {
        userId: "userId",
        employeeNo: "employeeNo",
        departmentId: "departmentId",
        rank: "rank",
        maxUnits: "maxUnits",
        maxHours: "maxHours",
        notes: "notes",
    },

    // ✅ NEW: first-time user gate attributes
    FIRST_LOGIN_USERS: {
        userId: "userId",
        mustChangePassword: "mustChangePassword",
        completed: "completed",
        createdAt: "createdAt",
        completedAt: "completedAt",
        lastResetAt: "lastResetAt",
    },

    SECTIONS: {
        termId: "termId",
        departmentId: "departmentId",
        programId: "programId",
        yearLevel: "yearLevel",
        name: "name",
        studentCount: "studentCount",
        isActive: "isActive",
    },
    SCHEDULE_VERSIONS: {
        termId: "termId",
        departmentId: "departmentId",
        version: "version",
        label: "label",
        status: "status",
        createdBy: "createdBy",
        lockedBy: "lockedBy",
        lockedAt: "lockedAt",
        notes: "notes",
    },
    CLASSES: {
        versionId: "versionId",
        termId: "termId",
        departmentId: "departmentId",
        programId: "programId",
        sectionId: "sectionId",
        subjectId: "subjectId",
        facultyUserId: "facultyUserId",
        classCode: "classCode",
        deliveryMode: "deliveryMode",
        status: "status",
        remarks: "remarks",
    },
    CLASS_MEETINGS: {
        versionId: "versionId",
        classId: "classId",
        dayOfWeek: "dayOfWeek",
        startTime: "startTime",
        endTime: "endTime",
        roomId: "roomId",
        meetingType: "meetingType",
        notes: "notes",
    },

    FACULTY_AVAILABILITY: {
        termId: "termId",
        userId: "userId",
        dayOfWeek: "dayOfWeek",
        startTime: "startTime",
        endTime: "endTime",
        preference: "preference",
        notes: "notes",
    },
    CHANGE_REQUESTS: {
        termId: "termId",
        departmentId: "departmentId",
        requestedBy: "requestedBy",
        classId: "classId",
        meetingId: "meetingId",
        type: "type",
        details: "details",
        status: "status",
        reviewedBy: "reviewedBy",
        reviewedAt: "reviewedAt",
        resolutionNotes: "resolutionNotes",
    },

    NOTIFICATIONS: {
        departmentId: "departmentId",
        termId: "termId",
        createdBy: "createdBy",
        type: "type",
        title: "title",
        message: "message",
        link: "link",
    },
    NOTIFICATION_RECIPIENTS: {
        notificationId: "notificationId",
        userId: "userId",
        isRead: "isRead",
        readAt: "readAt",
    },

    AUDIT_LOGS: {
        actorUserId: "actorUserId",
        action: "action",
        entityType: "entityType",
        entityId: "entityId",
        before: "before",
        after: "after",
        meta: "meta",
        createdAt: "createdAt",
    },
} as const;

/**
 * Index keys (names used in your migration)
 */
export const INDEX = {
    DEPARTMENTS: {
        codeUnique: "idx_departments_code_unique",
        nameFulltext: "idx_departments_name_fulltext",
    },
    PROGRAMS: {
        departmentId: "idx_programs_departmentId",
        deptCodeUnique: "idx_programs_dept_code_unique",
    },
    SUBJECTS: {
        codeUnique: "idx_subjects_code_unique",
        departmentId: "idx_subjects_departmentId",
        titleFulltext: "idx_subjects_title_fulltext",
    },
    ROOMS: {
        codeUnique: "idx_rooms_code_unique",
        type: "idx_rooms_type",
    },
    ACADEMIC_TERMS: {
        sySemUnique: "idx_terms_sy_sem_unique",
        isActive: "idx_terms_isActive",
    },
    TIME_BLOCKS: {
        termDay: "idx_timeblocks_term_day",
    },
    SYSTEM_POLICIES: {
        termKeyUnique: "idx_policies_term_key_unique",
        key: "idx_policies_key",
    },
    SETTINGS: {
        keyUnique: "idx_settings_key_unique",
    },
    USER_PROFILES: {
        userIdUnique: "idx_profiles_userId_unique",
        role: "idx_profiles_role",
        departmentId: "idx_profiles_departmentId",
    },
    FACULTY_PROFILES: {
        userIdUnique: "idx_faculty_userId_unique",
        departmentId: "idx_faculty_departmentId",
    },

    // ✅ NEW
    FIRST_LOGIN_USERS: {
        userIdUnique: "idx_firstlogin_userId_unique",
        completed: "idx_firstlogin_completed",
    },

    SECTIONS: {
        termDepartment: "idx_sections_term_department",
        termNameUnique: "idx_sections_term_name_unique",
    },
    SCHEDULE_VERSIONS: {
        termDept: "idx_versions_term_dept",
        unique: "idx_versions_unique",
        status: "idx_versions_status",
    },
    CLASSES: {
        versionId: "idx_classes_versionId",
        termDept: "idx_classes_term_dept",
        sectionId: "idx_classes_sectionId",
        subjectId: "idx_classes_subjectId",
        facultyUserId: "idx_classes_facultyUserId",
    },
    CLASS_MEETINGS: {
        classId: "idx_meetings_classId",
        versionId: "idx_meetings_versionId",
        roomTime: "idx_meetings_room_time",
    },
    FACULTY_AVAILABILITY: {
        termUser: "idx_availability_term_user",
        day: "idx_availability_day",
    },
    CHANGE_REQUESTS: {
        termDept: "idx_requests_term_dept",
        requestedBy: "idx_requests_requestedBy",
        status: "idx_requests_status",
    },
    NOTIFICATIONS: {
        departmentId: "idx_notifications_departmentId",
        termId: "idx_notifications_termId",
        type: "idx_notifications_type",
    },
    NOTIFICATION_RECIPIENTS: {
        userIsRead: "idx_notifrec_user_isRead",
        unique: "idx_notifrec_unique",
    },
    AUDIT_LOGS: {
        actor: "idx_audit_actor",
        entity: "idx_audit_entity",
    },
} as const;

/**
 * Appwrite document base fields (system fields)
 */
export type AppwriteSystemFields = {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions?: string[];
    $databaseId?: string;
    $collectionId?: string;
};

export type Doc<T> = T & AppwriteSystemFields;

/**
 * Common string unions for your schema
 */
export type RoomType = "LECTURE" | "LAB" | "OTHER" | (string & {});
export type ScheduleStatus = "Draft" | "Active" | "Locked" | "Archived" | (string & {});
export type ClassStatus = "Planned" | "Final" | "Cancelled" | (string & {});
export type MeetingType = "LECTURE" | "LAB" | "OTHER" | (string & {});
export type AvailabilityPreference = "Preferred" | "Unavailable" | "Neutral" | (string & {});
export type ChangeRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled" | (string & {});
export type UserRole = "ADMIN" | "FACULTY" | "CHAIR" | "DEAN" | "USER" | (string & {});

/**
 * Collection document shapes (data-only fields)
 */
export type Department = {
    code: string;
    name: string;
    isActive: boolean;
};

export type Program = {
    departmentId: string;
    code: string;
    name: string;
    description?: string | null;
    isActive: boolean;
};

export type Subject = {
    departmentId?: string | null;
    code: string;
    title: string;
    units: number;
    lectureHours: number;
    labHours: number;
    totalHours?: number | null;
    isActive: boolean;
};

export type Room = {
    code: string;
    name?: string | null;
    building?: string | null;
    floor?: string | null;
    capacity: number;
    type: RoomType;
    isActive: boolean;
};

export type AcademicTerm = {
    schoolYear: string;
    semester: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    isLocked: boolean;
};

export type TimeBlock = {
    termId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    label?: string | null;
    isActive: boolean;
};

export type SystemPolicy = {
    termId?: string | null;
    key: string;
    value: string;
    description?: string | null;
};

export type Setting = {
    key: string;
    value: string;
    description?: string | null;
    updatedBy?: string | null;
    updatedAt?: string | null;
};

export type UserProfile = {
    userId: string;
    email: string;
    name?: string | null;
    role: UserRole;
    departmentId?: string | null;
    isActive: boolean;
};

export type FacultyProfile = {
    userId: string;
    employeeNo?: string | null;
    departmentId: string;
    rank?: string | null;
    maxUnits?: number | null;
    maxHours?: number | null;
    notes?: string | null;
};

// ✅ NEW: first-time login record
export type FirstLoginUser = {
    userId: string;
    mustChangePassword: boolean;
    completed: boolean;
    createdAt?: string | null;
    completedAt?: string | null;
    lastResetAt?: string | null;
};

export type Section = {
    termId: string;
    departmentId: string;
    programId?: string | null;
    yearLevel: number;
    name: string;
    studentCount?: number | null;
    isActive: boolean;
};

export type ScheduleVersion = {
    termId: string;
    departmentId: string;
    version: number;
    label?: string | null;
    status: ScheduleStatus;
    createdBy: string;
    lockedBy?: string | null;
    lockedAt?: string | null;
    notes?: string | null;
};

export type ClassOffering = {
    versionId: string;
    termId: string;
    departmentId: string;
    programId?: string | null;
    sectionId: string;
    subjectId: string;
    facultyUserId?: string | null;
    classCode?: string | null;
    deliveryMode?: string | null;
    status: ClassStatus;
    remarks?: string | null;
};

export type ClassMeeting = {
    versionId: string;
    classId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    roomId?: string | null;
    meetingType: MeetingType;
    notes?: string | null;
};

export type FacultyAvailability = {
    termId: string;
    userId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    preference: AvailabilityPreference;
    notes?: string | null;
};

export type ChangeRequest = {
    termId: string;
    departmentId: string;
    requestedBy: string;
    classId?: string | null;
    meetingId?: string | null;
    type: string;
    details: string;
    status: ChangeRequestStatus;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    resolutionNotes?: string | null;
};

export type Notification = {
    departmentId?: string | null;
    termId?: string | null;
    createdBy: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
};

export type NotificationRecipient = {
    notificationId: string;
    userId: string;
    isRead: boolean;
    readAt?: string | null;
};

export type AuditLog = {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: string | null;
    after?: string | null;
    meta?: string | null;
    createdAt?: string | null;
};

/**
 * Typed Appwrite docs (with system fields)
 */
export type DepartmentDoc = Doc<Department>;
export type ProgramDoc = Doc<Program>;
export type SubjectDoc = Doc<Subject>;
export type RoomDoc = Doc<Room>;
export type AcademicTermDoc = Doc<AcademicTerm>;
export type TimeBlockDoc = Doc<TimeBlock>;
export type SystemPolicyDoc = Doc<SystemPolicy>;
export type SettingDoc = Doc<Setting>;
export type UserProfileDoc = Doc<UserProfile>;
export type FacultyProfileDoc = Doc<FacultyProfile>;
export type FirstLoginUserDoc = Doc<FirstLoginUser>;
export type SectionDoc = Doc<Section>;
export type ScheduleVersionDoc = Doc<ScheduleVersion>;
export type ClassOfferingDoc = Doc<ClassOffering>;
export type ClassMeetingDoc = Doc<ClassMeeting>;
export type FacultyAvailabilityDoc = Doc<FacultyAvailability>;
export type ChangeRequestDoc = Doc<ChangeRequest>;
export type NotificationDoc = Doc<Notification>;
export type NotificationRecipientDoc = Doc<NotificationRecipient>;
export type AuditLogDoc = Doc<AuditLog>;

/**
 * Optional: map collection -> doc type
 */
export type CollectionDocMap = {
    [COLLECTIONS.DEPARTMENTS]: DepartmentDoc;
    [COLLECTIONS.PROGRAMS]: ProgramDoc;
    [COLLECTIONS.SUBJECTS]: SubjectDoc;
    [COLLECTIONS.ROOMS]: RoomDoc;
    [COLLECTIONS.ACADEMIC_TERMS]: AcademicTermDoc;
    [COLLECTIONS.TIME_BLOCKS]: TimeBlockDoc;
    [COLLECTIONS.SYSTEM_POLICIES]: SystemPolicyDoc;
    [COLLECTIONS.SETTINGS]: SettingDoc;

    [COLLECTIONS.USER_PROFILES]: UserProfileDoc;
    [COLLECTIONS.FACULTY_PROFILES]: FacultyProfileDoc;

    [COLLECTIONS.FIRST_LOGIN_USERS]: FirstLoginUserDoc;

    [COLLECTIONS.SECTIONS]: SectionDoc;
    [COLLECTIONS.SCHEDULE_VERSIONS]: ScheduleVersionDoc;
    [COLLECTIONS.CLASSES]: ClassOfferingDoc;
    [COLLECTIONS.CLASS_MEETINGS]: ClassMeetingDoc;

    [COLLECTIONS.FACULTY_AVAILABILITY]: FacultyAvailabilityDoc;
    [COLLECTIONS.CHANGE_REQUESTS]: ChangeRequestDoc;

    [COLLECTIONS.NOTIFICATIONS]: NotificationDoc;
    [COLLECTIONS.NOTIFICATION_RECIPIENTS]: NotificationRecipientDoc;

    [COLLECTIONS.AUDIT_LOGS]: AuditLogDoc;
};
