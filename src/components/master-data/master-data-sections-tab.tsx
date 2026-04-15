"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { databases, DATABASE_ID, COLLECTIONS, ID } from "@/lib/db";
import type { MasterDataManagementVM } from "./use-master-data";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";

type Props = {
  vm: MasterDataManagementVM;
};

type SectionGroup = {
  key: string;
  label: string;
  scopeSummary: string;
  sections: any[];
  uniqueSubjectIds: string[];
  linkedSubjects: any[];
  inheritedSubjectCount: number;
  representative: any;
};

type PendingSectionAction =
  | {
      kind: "mergeSections";
      groupKeys: string[];
      groupCount: number;
      duplicateCount: number;
    }
  | {
      kind: "linkAcademicTerms";
      groupKeys: string[];
      groupCount: number;
      missingLinkCount: number;
    };

type MissingAcademicTermGroup = {
  group: SectionGroup;
  linkedTerms: Array<{ id: string; label: string }>;
  missingTerms: Array<{ id: string; label: string }>;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

function normalizeProgramCode(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeSectionYearLevelValue(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeSectionNameValue(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function resolveProgramPrefix(
  vm: MasterDataManagementVM,
  programId?: string | null,
) {
  const normalizedProgramId = String(programId ?? "").trim();
  if (!normalizedProgramId) return "";

  const program = vm.programs.find(
    (item) => String(item.$id) === normalizedProgramId,
  );
  const normalizedCode = normalizeProgramCode(program?.code);

  if (!normalizedCode) return "";
  if (
    normalizedCode === "CS" ||
    normalizedCode === "BSCS" ||
    normalizedCode.endsWith("CS")
  ) {
    return "CS";
  }
  if (
    normalizedCode === "IS" ||
    normalizedCode === "BSIS" ||
    normalizedCode.endsWith("IS")
  ) {
    return "IS";
  }

  return "";
}

function buildStoredSectionYearLevel(
  vm: MasterDataManagementVM,
  value?: string | number | null,
  programId?: string | null,
) {
  const normalizedYearLevel = normalizeSectionYearLevelValue(value);
  const yearNumber =
    normalizedYearLevel.match(/([1-9]\d*)$/)?.[1] ?? normalizedYearLevel;
  const programPrefix = resolveProgramPrefix(vm, programId ?? null);

  if (!normalizedYearLevel) return "";
  if (!yearNumber) return normalizedYearLevel;
  if (!programPrefix) return normalizedYearLevel;
  if (normalizedYearLevel.startsWith(`${programPrefix} `))
    return normalizedYearLevel;

  return `${programPrefix} ${yearNumber}`;
}

function buildSectionDisplayLabel(
  vm: MasterDataManagementVM,
  section: {
    yearLevel?: string | number | null;
    name?: string | null;
    programId?: string | null;
  },
) {
  const normalizedYearLevel = normalizeSectionYearLevelValue(section.yearLevel);
  const normalizedName = normalizeSectionNameValue(section.name);
  const yearNumber =
    normalizedYearLevel.match(/([1-9]\d*)$/)?.[1] ?? normalizedYearLevel;
  const programPrefix = resolveProgramPrefix(vm, section.programId ?? null);

  const displayYearLevel =
    normalizedYearLevel &&
    programPrefix &&
    !normalizedYearLevel.startsWith(`${programPrefix} `)
      ? `${programPrefix} ${yearNumber}`
      : normalizedYearLevel;

  if (!displayYearLevel && !normalizedName) return "—";
  if (!displayYearLevel) return normalizedName;
  if (!normalizedName) return displayYearLevel;

  return `${displayYearLevel} - ${normalizedName}`;
}

function resolveSectionSubjectIds(section: {
  subjectId?: string | null;
  subjectIds?: string[] | string | null;
}) {
  const values = Array.isArray(section.subjectIds)
    ? section.subjectIds
    : typeof section.subjectIds === "string"
      ? section.subjectIds.split(",")
      : [];

  const normalized = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (normalized.length > 0) return Array.from(new Set(normalized));

  const fallback = String(section.subjectId ?? "").trim();
  return fallback ? [fallback] : [];
}

function buildSectionSubjectSummary(
  vm: MasterDataManagementVM,
  section: { subjectId?: string | null; subjectIds?: string[] | string | null },
) {
  const labels = resolveSectionSubjectIds(section)
    .map((subjectId) =>
      vm.subjects.find((subject) => String(subject.$id) === subjectId),
    )
    .filter(Boolean)
    .map((subject) => `${subject?.code} — ${subject?.title}`);

  return labels.length > 0 ? labels.join(", ") : "—";
}

function formatSectionBulkEditError(error: any) {
  const message = String(error?.message ?? "").trim();

  if (
    message &&
    /subjectids/i.test(message) &&
    /(attribute|column|schema|unknown|invalid)/i.test(message)
  ) {
    return "Backend is missing sections.subjectIds. Run migration 013_add_section_subject_ids.";
  }

  return message || "Update failed.";
}

function normalizeSectionCoverageLabel(value?: string | null) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  if (/^(?:—|-|–|n\/a|na|null|none)$/i.test(normalized)) return "";

  return normalized;
}

function resolveSectionReferenceTermLabel(
  vm: MasterDataManagementVM,
  section: any,
) {
  return (
    normalizeSectionCoverageLabel(section?.academicTermLabel) ||
    normalizeSectionCoverageLabel(vm.termLabel(vm.terms, section?.termId)) ||
    "All Academic Terms"
  );
}

function resolveAcademicTermLabel(vm: MasterDataManagementVM, term: any) {
  const termId = String(term?.$id ?? "").trim();

  return (
    normalizeSectionCoverageLabel(term?.academicTermLabel) ||
    normalizeSectionCoverageLabel(term?.label) ||
    normalizeSectionCoverageLabel(term?.name) ||
    normalizeSectionCoverageLabel(term?.title) ||
    normalizeSectionCoverageLabel(vm.termLabel(vm.terms, termId)) ||
    (termId ? `Academic Term ${termId}` : "Unnamed Academic Term")
  );
}

function resolveSubjectTermId(subject?: any) {
  return String(subject?.termId ?? "").trim();
}

function buildSectionDuplicateScopeKey(
  vm: MasterDataManagementVM,
  section: any,
) {
  return buildSectionDisplayLabel(vm, section)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildSectionGroupKey(vm: MasterDataManagementVM, section: any) {
  return buildSectionDuplicateScopeKey(vm, section);
}

function buildSectionTermCoverageKey(section: any) {
  const normalizedTermId = String(section?.termId ?? "").trim();
  return normalizedTermId || "__all_terms__";
}

function buildSectionMergeGroupKey(
  vm: MasterDataManagementVM,
  section: any,
) {
  return `${buildSectionDuplicateScopeKey(vm, section)}::${buildSectionTermCoverageKey(section)}`;
}

function getPreferredStringValue(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return (
    Array.from(counts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })[0]?.[0] ?? ""
  );
}

function buildSectionGroupScopeSummary(
  vm: MasterDataManagementVM,
  sections: any[],
) {
  const collegeLabels = uniqueStrings(
    sections.map((section) => {
      const label = String(
        vm.collegeLabel(vm.colleges, section?.departmentId) ?? "",
      ).trim();
      return /^(?:—|-|–|unknown)$/i.test(label) ? "" : label;
    }),
  );
  const programLabels = uniqueStrings(
    sections.map((section) => {
      const label = String(
        vm.programLabel(vm.programs, section?.programId ?? null) ?? "",
      ).trim();
      return /^(?:—|-|–)$/i.test(label) ? "" : label;
    }),
  );

  if (collegeLabels.length <= 1 && programLabels.length <= 1) {
    return (
      [collegeLabels[0], programLabels[0]].filter(Boolean).join(" • ") ||
      "Scope not set"
    );
  }

  const collegeSummary =
    collegeLabels.length === 0
      ? null
      : collegeLabels.length === 1
        ? collegeLabels[0]
        : `${collegeLabels.length} colleges`;
  const programSummary =
    programLabels.length === 0
      ? null
      : programLabels.length === 1
        ? programLabels[0]
        : `${programLabels.length} programs`;

  return (
    [collegeSummary, programSummary].filter(Boolean).join(" • ") ||
    "Scope not set"
  );
}

function compareByCreatedAt(a: any, b: any) {
  const aTime = Date.parse(String(a?.$createdAt ?? "")) || 0;
  const bTime = Date.parse(String(b?.$createdAt ?? "")) || 0;
  if (aTime !== bTime) return aTime - bTime;
  return String(a?.$id ?? "").localeCompare(String(b?.$id ?? ""));
}

function getCanonicalRecord(records: any[]) {
  return records.slice().sort(compareByCreatedAt)[0];
}

function getBestStudentCount(sections: any[]) {
  const counts = sections
    .map((section) =>
      section?.studentCount == null ? null : Number(section.studentCount),
    )
    .filter((value) => Number.isFinite(value)) as number[];

  if (counts.length === 0) return null;
  return Math.max(...counts);
}

function buildMergedSectionPayload(
  vm: MasterDataManagementVM,
  sections: any[],
  canonical: any,
) {
  const mergedSubjectIds = uniqueStrings(
    sections.flatMap((section) => resolveSectionSubjectIds(section)),
  );
  const mergedDepartmentId =
    getPreferredStringValue(
      sections.map((section) => String(section?.departmentId ?? "").trim()),
    ) || null;
  const mergedProgramId =
    getPreferredStringValue(
      sections.map((section) => String(section?.programId ?? "").trim()),
    ) || null;
  const mergedYearLevel =
    buildStoredSectionYearLevel(vm, canonical?.yearLevel, mergedProgramId) ||
    buildStoredSectionYearLevel(vm, sections[0]?.yearLevel, mergedProgramId) ||
    normalizeSectionYearLevelValue(canonical?.yearLevel) ||
    normalizeSectionYearLevelValue(sections[0]?.yearLevel);

  return {
    departmentId: mergedDepartmentId,
    programId: mergedProgramId,
    subjectId: mergedSubjectIds[0] ?? null,
    subjectIds: mergedSubjectIds,
    yearLevel: mergedYearLevel,
    name: normalizeSectionNameValue(canonical?.name ?? sections[0]?.name),
    studentCount: getBestStudentCount(sections),
    isActive: sections.some((section) => Boolean(section?.isActive)),
  };
}

function buildSectionGroup(vm: MasterDataManagementVM, key: string, sections: any[]) {
  const representative = getCanonicalRecord(sections);
  const uniqueSubjectIds = uniqueStrings(
    sections.flatMap((section) => resolveSectionSubjectIds(section)),
  );
  const linkedSubjects = uniqueSubjectIds
    .map((subjectId) =>
      vm.subjects.find((subject) => String(subject.$id) === subjectId),
    )
    .filter(Boolean)
    .sort((a, b) =>
      `${a?.code} ${a?.title}`.localeCompare(`${b?.code} ${b?.title}`),
    );
  const inheritedSubjectCount = linkedSubjects.filter(
    (subject) => !resolveSubjectTermId(subject),
  ).length;

  return {
    key,
    label: buildSectionDisplayLabel(vm, representative),
    scopeSummary: buildSectionGroupScopeSummary(vm, sections),
    sections,
    uniqueSubjectIds,
    linkedSubjects,
    inheritedSubjectCount,
    representative,
  };
}

function buildLinkedSectionTermPayload(
  vm: MasterDataManagementVM,
  group: SectionGroup,
  term: { id: string; label: string; semester?: string | null },
) {
  const canonical = getCanonicalRecord(group.sections);
  const mergedPayload = buildMergedSectionPayload(vm, group.sections, canonical);

  const preferredSubjectIds = uniqueStrings(
    group.linkedSubjects
      .filter((subject) => {
        const subjectTermId = resolveSubjectTermId(subject);
        return !subjectTermId || subjectTermId === term.id;
      })
      .map((subject) => String(subject?.$id ?? "").trim()),
  );

  const subjectIds =
    preferredSubjectIds.length > 0 ? preferredSubjectIds : mergedPayload.subjectIds;

  return {
    ...mergedPayload,
    subjectId: subjectIds[0] ?? mergedPayload.subjectId ?? null,
    subjectIds,
    termId: term.id,
    semester: String(term.semester ?? "").trim() || null,
    academicTermLabel: term.label,
  };
}

export function MasterDataSectionsTab({ vm }: Props) {
  const [missingTermDialogOpen, setMissingTermDialogOpen] =
    React.useState(false);

  const [selectedSectionDetail, setSelectedSectionDetail] =
    React.useState<SectionGroup | null>(null);

  const [subjectViewerOpen, setSubjectViewerOpen] = React.useState(false);
  const [subjectViewerTitle, setSubjectViewerTitle] =
    React.useState("Linked Subjects");
  const [subjectViewerDescription, setSubjectViewerDescription] =
    React.useState("");
  const [subjectViewerSubjects, setSubjectViewerSubjects] = React.useState<
    any[]
  >([]);

  const [sectionDedupeBusy, setSectionDedupeBusy] = React.useState(false);
  const [sectionTermLinkBusy, setSectionTermLinkBusy] = React.useState(false);
  const [pendingSectionAction, setPendingSectionAction] =
    React.useState<PendingSectionAction | null>(null);
  const [pendingSectionActionSubmitting, setPendingSectionActionSubmitting] =
    React.useState(false);
  const [sectionMergeKeepByGroup, setSectionMergeKeepByGroup] = React.useState<
    Record<string, string>
  >({});

  const compactActionButtonClassName =
    "h-8 w-full justify-center px-2 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm";
  const compactInlineButtonClassName =
    "h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm";
  const wrappingBadgeClassName =
    "h-auto max-w-full whitespace-normal break-words px-2 py-1 text-center leading-4";

  const sortedSections = React.useMemo(
    () =>
      vm.filteredSections.slice().sort((a, b) => {
        const left = `${a.departmentId}-${a.programId ?? ""}-${a.yearLevel}-${a.name}`;
        const right = `${b.departmentId}-${b.programId ?? ""}-${b.yearLevel}-${b.name}`;
        return left.localeCompare(right);
      }),
    [vm.filteredSections],
  );

  const visibleGroups = React.useMemo<SectionGroup[]>(() => {
    const grouped = new Map<string, any[]>();

    for (const section of sortedSections) {
      const key = buildSectionGroupKey(vm, section);
      const current = grouped.get(key) || [];
      current.push(section);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .map(([key, sections]) => buildSectionGroup(vm, key, sections))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [sortedSections, vm]);

  const allMergeCandidateGroups = React.useMemo<SectionGroup[]>(() => {
    const grouped = new Map<string, any[]>();

    for (const section of vm.sections) {
      const key = buildSectionMergeGroupKey(vm, section);
      const current = grouped.get(key) || [];
      current.push(section);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .map(([key, sections]) => buildSectionGroup(vm, key, sections))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [vm]);

  const allDuplicateSectionGroups = React.useMemo(
    () => allMergeCandidateGroups.filter((group) => group.sections.length > 1),
    [allMergeCandidateGroups],
  );

  const pendingMergeSectionGroups = React.useMemo(
    () =>
      pendingSectionAction?.kind === "mergeSections"
        ? allMergeCandidateGroups.filter((group) =>
            pendingSectionAction.groupKeys.includes(group.key),
          )
        : [],
    [allMergeCandidateGroups, pendingSectionAction],
  );

  const academicTerms = React.useMemo(
    () =>
      vm.terms
        .map((term) => ({
          id: String(term?.$id ?? "").trim(),
          label: resolveAcademicTermLabel(vm, term),
          semester: String(term?.semester ?? "").trim() || null,
        }))
        .filter((term) => term.id)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [vm],
  );

  const missingAcademicTermGroups = React.useMemo<MissingAcademicTermGroup[]>(
    () =>
      visibleGroups
        .map((group) => {
          const linkedTerms = uniqueStrings(
            group.sections.map((section) => String(section.termId ?? "").trim()),
          )
            .map((termId) => ({
              id: termId,
              label:
                academicTerms.find((term) => term.id === termId)?.label ||
                normalizeSectionCoverageLabel(vm.termLabel(vm.terms, termId)) ||
                `Academic Term ${termId}`,
            }))
            .sort((a, b) =>
              a.label.localeCompare(b.label, undefined, {
                numeric: true,
                sensitivity: "base",
              }),
            );

          const missingTerms = academicTerms.filter(
            (term) =>
              !linkedTerms.some((linkedTerm) => linkedTerm.id === term.id),
          );

          return {
            group,
            linkedTerms,
            missingTerms,
          };
        })
        .filter((result) => result.missingTerms.length > 0),
    [academicTerms, visibleGroups, vm],
  );

  const missingAcademicTermCount = React.useMemo(
    () =>
      missingAcademicTermGroups.reduce(
        (count, group) => count + group.missingTerms.length,
        0,
      ),
    [missingAcademicTermGroups],
  );

  const openMissingAcademicTermDialog = React.useCallback(() => {
    if (visibleGroups.length === 0) {
      toast.error("No visible sections found.");
      return;
    }

    if (academicTerms.length === 0) {
      toast.error("No academic terms found.");
      return;
    }

    setMissingTermDialogOpen(true);
  }, [academicTerms.length, visibleGroups.length]);

  const requestLinkAcademicTerms = React.useCallback(
    (groups: MissingAcademicTermGroup[]) => {
      if (groups.length === 0) {
        toast.success(
          "All visible section groups are already linked to every academic term.",
        );
        return;
      }

      setPendingSectionAction({
        kind: "linkAcademicTerms",
        groupKeys: groups.map((result) => result.group.key),
        groupCount: groups.length,
        missingLinkCount: groups.reduce(
          (count, result) => count + result.missingTerms.length,
          0,
        ),
      });
    },
    [],
  );

  const mergeSectionGroups = React.useCallback(
    async (
      groups: SectionGroup[],
      keepByGroup: Record<string, string> = {},
    ) => {
      if (groups.length === 0) {
        toast.error("No duplicate reusable section groups found.");
        return;
      }

      setSectionDedupeBusy(true);
      try {
        let mergedGroups = 0;
        let deleted = 0;
        let rewiredClasses = 0;
        const failed: string[] = [];

        for (const group of groups) {
          const selectedKeepId = String(keepByGroup[group.key] ?? "").trim();
          const canonical =
            group.sections.find(
              (section) => String(section.$id) === selectedKeepId,
            ) ?? getCanonicalRecord(group.sections);
          const duplicates = group.sections.filter(
            (section) => String(section.$id) !== String(canonical.$id),
          );
          if (duplicates.length === 0) continue;

          try {
            await databases.updateDocument(
              DATABASE_ID,
              COLLECTIONS.SECTIONS,
              canonical.$id,
              buildMergedSectionPayload(vm, group.sections, canonical),
            );

            for (const duplicate of duplicates) {
              const referencingClasses = vm.classes.filter(
                (classDoc) =>
                  String(classDoc.sectionId ?? "").trim() ===
                  String(duplicate.$id),
              );

              for (const classDoc of referencingClasses) {
                await databases.updateDocument(
                  DATABASE_ID,
                  COLLECTIONS.CLASSES,
                  classDoc.$id,
                  {
                    sectionId: canonical.$id,
                  },
                );
                rewiredClasses += 1;
              }

              await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.SECTIONS,
                duplicate.$id,
              );
              deleted += 1;
            }

            mergedGroups += 1;
          } catch (error: any) {
            failed.push(
              `${group.label} (${formatSectionBulkEditError(error)})`,
            );
          }
        }

        if (mergedGroups > 0) {
          await vm.refreshAll();
        }

        if (mergedGroups > 0 && failed.length === 0) {
          toast.success(
            `Merged ${mergedGroups} duplicate section group${mergedGroups === 1 ? "" : "s"}, deleted ${deleted} duplicate record${deleted === 1 ? "" : "s"}, and rewired ${rewiredClasses} class reference${rewiredClasses === 1 ? "" : "s"}.`,
          );
          return;
        }

        if (mergedGroups > 0) {
          toast.error(
            `Merged ${mergedGroups} section group${mergedGroups === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`,
          );
          return;
        }

        toast.error(
          failed.length > 0
            ? `Failed to merge duplicate sections: ${failed.join(", ")}`
            : "No duplicate sections were merged.",
        );
      } finally {
        setSectionDedupeBusy(false);
      }
    },
    [vm],
  );

  const linkSectionGroupsToAcademicTerms = React.useCallback(
    async (groups: MissingAcademicTermGroup[]) => {
      if (groups.length === 0) {
        toast.success(
          "All visible section groups are already linked to every academic term.",
        );
        return;
      }

      setSectionTermLinkBusy(true);
      try {
        let created = 0;
        let skipped = 0;
        const failed: string[] = [];

        for (const result of groups) {
          for (const term of result.missingTerms) {
            try {
              await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SECTIONS,
                ID.unique(),
                buildLinkedSectionTermPayload(vm, result.group, {
                  ...term,
                  semester:
                    academicTerms.find(
                      (academicTerm) => academicTerm.id === term.id,
                    )?.semester ?? null,
                }),
              );
              created += 1;
            } catch (error: any) {
              const message = String(error?.message ?? "").trim();

              if (
                message &&
                /(duplicate|already exists|document with the requested ID already exists)/i.test(
                  message,
                )
              ) {
                skipped += 1;
                continue;
              }

              failed.push(
                `${result.group.label} • ${term.label} (${formatSectionBulkEditError(error)})`,
              );
            }
          }
        }

        if (created > 0 || skipped > 0) {
          await vm.refreshAll();
        }

        if (created > 0 && failed.length === 0) {
          toast.success(
            `Linked ${created} missing section record${created === 1 ? "" : "s"} to academic terms.${skipped > 0 ? ` Skipped ${skipped}.` : ""}`,
          );
          return;
        }

        if (created > 0 || skipped > 0) {
          toast.error(
            `Created ${created} section term link${created === 1 ? "" : "s"}${skipped > 0 ? ` and skipped ${skipped}` : ""}, but failed for: ${failed.join(", ")}`,
          );
          return;
        }

        toast.error(
          failed.length > 0
            ? `Failed to link sections to academic terms: ${failed.join(", ")}`
            : "No section term links were created.",
        );
      } finally {
        setSectionTermLinkBusy(false);
      }
    },
    [academicTerms, vm],
  );

  const requestMergeSectionGroups = React.useCallback(
    (groups: SectionGroup[]) => {
      if (groups.length === 0) {
        toast.error("No duplicate reusable section groups found.");
        return;
      }

      const duplicateCount = groups.reduce(
        (count, group) => count + Math.max(group.sections.length - 1, 0),
        0,
      );
      setSectionMergeKeepByGroup(
        Object.fromEntries(
          groups.map((group) => [
            group.key,
            String(getCanonicalRecord(group.sections)?.$id ?? ""),
          ]),
        ),
      );
      setPendingSectionAction({
        kind: "mergeSections",
        groupKeys: groups.map((group) => group.key),
        groupCount: groups.length,
        duplicateCount,
      });
    },
    [],
  );

  const handleConfirmPendingSectionAction = React.useCallback(async () => {
    if (!pendingSectionAction || pendingSectionActionSubmitting) return;

    const action = pendingSectionAction;
    setPendingSectionActionSubmitting(true);

    try {
      if (action.kind === "linkAcademicTerms") {
        const groups = missingAcademicTermGroups.filter((result) =>
          action.groupKeys.includes(result.group.key),
        );
        await linkSectionGroupsToAcademicTerms(groups);
        setPendingSectionAction(null);
        setMissingTermDialogOpen(false);
        return;
      }

      const groups = allMergeCandidateGroups.filter((group) =>
        action.groupKeys.includes(group.key),
      );
      const normalizedKeepByGroup = Object.fromEntries(
        groups.map((group) => {
          const selectedKeepId = String(
            sectionMergeKeepByGroup[group.key] ?? "",
          ).trim();
          const fallbackKeepId = String(
            getCanonicalRecord(group.sections)?.$id ?? "",
          );
          return [group.key, selectedKeepId || fallbackKeepId];
        }),
      );
      await mergeSectionGroups(groups, normalizedKeepByGroup);
      setSectionMergeKeepByGroup({});
      setPendingSectionAction(null);
    } finally {
      setPendingSectionActionSubmitting(false);
    }
  }, [
    allMergeCandidateGroups,
    linkSectionGroupsToAcademicTerms,
    mergeSectionGroups,
    missingAcademicTermGroups,
    pendingSectionAction,
    pendingSectionActionSubmitting,
    sectionMergeKeepByGroup,
  ]);

  const pendingSectionActionBusy =
    pendingSectionActionSubmitting || sectionDedupeBusy || sectionTermLinkBusy;

  const openSubjectViewer = React.useCallback(
    (config: { title: string; description: string; subjects: any[] }) => {
      setSubjectViewerTitle(config.title);
      setSubjectViewerDescription(config.description);
      setSubjectViewerSubjects(config.subjects);
      setSubjectViewerOpen(true);
    },
    [],
  );

  const selectedSectionDetailTermLabels = React.useMemo(
    () =>
      selectedSectionDetail
        ? uniqueStrings(
            selectedSectionDetail.sections.map((section) =>
              resolveSectionReferenceTermLabel(vm, section),
            ),
          )
        : [],
    [selectedSectionDetail, vm],
  );

  const selectedSectionDetailActiveCount = React.useMemo(
    () =>
      selectedSectionDetail
        ? selectedSectionDetail.sections.filter((section) =>
            Boolean(section?.isActive),
          ).length
        : 0,
    [selectedSectionDetail],
  );

  return (
    <TabsContent value="sections" className="space-y-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="font-medium">Sections</div>
            <div className="text-sm text-muted-foreground">
              Manage reusable section records that stay available across all
              academic terms. Use the group actions below for linked-subject
              updates and duplicate cleanup.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              size="sm"
              className={compactActionButtonClassName}
              onClick={() => {
                vm.setSectionEditing(null);
                vm.setSectionOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="min-w-0 truncate">Add Section</span>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant="secondary"
                className={`rounded-full ${wrappingBadgeClassName}`}
              >
                {sortedSections.length} visible records
              </Badge>
              <Badge
                variant="outline"
                className={`rounded-full ${wrappingBadgeClassName}`}
              >
                {visibleGroups.length} section group
                {visibleGroups.length === 1 ? "" : "s"}
              </Badge>
              <span>
                Term-linking now runs directly from the visible section list.
              </span>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={compactActionButtonClassName}
                  onClick={openMissingAcademicTermDialog}
                  disabled={visibleGroups.length === 0 || academicTerms.length === 0}
                >
                  <span className="min-w-0 truncate">
                    Link Sections to Academic Terms
                  </span>
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Badge
                  variant="outline"
                  className={`rounded-full ${wrappingBadgeClassName}`}
                >
                  {missingAcademicTermGroups.length} section group
                  {missingAcademicTermGroups.length === 1 ? "" : "s"} missing
                  {" "}
                  {missingAcademicTermCount} academic term link
                  {missingAcademicTermCount === 1 ? "" : "s"}
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={compactActionButtonClassName}
                  onClick={() =>
                    requestMergeSectionGroups(allDuplicateSectionGroups)
                  }
                  disabled={
                    allDuplicateSectionGroups.length === 0 || sectionDedupeBusy
                  }
                >
                  <span className="min-w-0 truncate">
                    Delete Duplicated Sections (
                    {allDuplicateSectionGroups.length})
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {vm.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No reusable sections found.
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            <AccordionItem
              value="sections"
              className="overflow-hidden rounded-2xl border"
            >
              <AccordionTrigger className="px-4 py-4 hover:no-underline">
                <span className="text-base font-semibold sm:hidden">
                  Section
                </span>

                <div className="hidden min-w-0 flex-1 flex-col gap-2 text-left sm:flex">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">Section</span>
                    <Badge
                      variant="secondary"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {visibleGroups.length}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {allDuplicateSectionGroups.length} duplicate group
                      {allDuplicateSectionGroups.length === 1 ? "" : "s"} with
                      matching term coverage
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Open to view all visible section groups below. Duplicate
                    detection only merges records that share the same term
                    coverage.
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t px-4 pb-4 pt-4">
                <div className="space-y-3 sm:hidden">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {visibleGroups.length} section
                      {visibleGroups.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {sortedSections.length} visible record
                      {sortedSections.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {allDuplicateSectionGroups.length} duplicate group
                      {allDuplicateSectionGroups.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="overflow-hidden rounded-2xl border bg-background">
                    {visibleGroups.map((group) => (
                      <div
                        key={group.key}
                        className="flex items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="wrap-break-word text-sm font-medium leading-5">
                            {group.label}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={compactInlineButtonClassName}
                          onClick={() => setSelectedSectionDetail(group)}
                        >
                          Details
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {visibleGroups.length} section
                      {visibleGroups.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {sortedSections.length} visible record
                      {sortedSections.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {allDuplicateSectionGroups.length} duplicate group
                      {allDuplicateSectionGroups.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="overflow-hidden rounded-2xl border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section</TableHead>
                          <TableHead className="w-32 text-right">
                            Details
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleGroups.map((group) => (
                          <TableRow key={group.key}>
                            <TableCell className="font-medium">
                              <div className="wrap-break-word">
                                {group.label}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={compactInlineButtonClassName}
                                onClick={() => setSelectedSectionDetail(group)}
                              >
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingSectionAction)}
        onOpenChange={(open) => {
          if (!open && !pendingSectionActionBusy) {
            setPendingSectionAction(null);
            setSectionMergeKeepByGroup({});
          }
        }}
      >
        <AlertDialogContent className="max-h-[90svh] overflow-hidden sm:max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSectionAction?.kind === "linkAcademicTerms"
                ? "Link Missing Academic Terms"
                : "Delete Duplicated Sections"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSectionAction?.kind === "linkAcademicTerms"
                ? `Create ${pendingSectionAction.missingLinkCount} missing academic-term section record${pendingSectionAction.missingLinkCount === 1 ? "" : "s"} across ${pendingSectionAction.groupCount} visible section group${pendingSectionAction.groupCount === 1 ? "" : "s"}.`
                : pendingSectionAction?.kind === "mergeSections"
                  ? `Review each duplicate section group below. Choose the section record to keep, then continue. The other duplicate record${pendingSectionAction.duplicateCount === 1 ? " will" : "s will"} be deleted and their class references will be moved automatically.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingSectionAction?.kind === "linkAcademicTerms" ? (
            <ScrollArea className="max-h-[52svh] rounded-md border">
              <div className="space-y-3 p-3">
                {missingAcademicTermGroups
                  .filter((result) =>
                    pendingSectionAction.groupKeys.includes(result.group.key),
                  )
                  .map((result) => (
                    <div
                      key={result.group.key}
                      className="rounded-xl border bg-muted/20 p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">
                            {result.group.label}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`rounded-full ${wrappingBadgeClassName}`}
                          >
                            {result.missingTerms.length} missing term
                            {result.missingTerms.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.group.scopeSummary}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Current links:{" "}
                          {result.linkedTerms.length > 0
                            ? result.linkedTerms
                                .map((term) => term.label)
                                .join(", ")
                            : "None"}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.missingTerms.map((term) => (
                          <Badge
                            key={`${result.group.key}-${term.id}`}
                            variant="outline"
                            className={wrappingBadgeClassName}
                          >
                            {term.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          ) : pendingSectionAction?.kind === "mergeSections" ? (
            <ScrollArea className="max-h-[52svh] rounded-md border">
              <div className="space-y-3 p-3">
                {pendingMergeSectionGroups.map((group) => {
                  const selectedKeepId =
                    String(sectionMergeKeepByGroup[group.key] ?? "").trim() ||
                    String(getCanonicalRecord(group.sections)?.$id ?? "");

                  return (
                    <div
                      key={group.key}
                      className="rounded-xl border bg-muted/20 p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">
                            {group.label}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`rounded-full ${wrappingBadgeClassName}`}
                          >
                            {group.sections.length} duplicate records
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.scopeSummary}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3">
                        {group.sections.map((section) => {
                          const sectionId = String(section.$id);
                          const keepSelected = sectionId === selectedKeepId;
                          return (
                            <div
                              key={sectionId}
                              className={
                                keepSelected
                                  ? "rounded-xl border border-primary bg-primary/5 p-3"
                                  : "rounded-xl border bg-background p-3"
                              }
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium wrap-break-word">
                                      {buildSectionDisplayLabel(vm, section)}
                                    </div>
                                    <Badge
                                      variant={
                                        keepSelected ? "default" : "outline"
                                      }
                                      className={`rounded-full ${wrappingBadgeClassName}`}
                                    >
                                      {keepSelected ? "Keep" : "Delete"}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground wrap-break-word">
                                    Academic term:{" "}
                                    {resolveSectionReferenceTermLabel(
                                      vm,
                                      section,
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground wrap-break-word">
                                    Students:{" "}
                                    {section.studentCount != null
                                      ? section.studentCount
                                      : "—"}{" "}
                                    • Active: {section.isActive ? "Yes" : "No"}
                                  </div>
                                  <div className="text-xs text-muted-foreground wrap-break-word">
                                    Subjects:{" "}
                                    {buildSectionSubjectSummary(vm, section)}
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  variant={keepSelected ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 w-full px-3 text-xs sm:w-auto"
                                  onClick={() =>
                                    setSectionMergeKeepByGroup((current) => ({
                                      ...current,
                                      [group.key]: sectionId,
                                    }))
                                  }
                                >
                                  {keepSelected
                                    ? "Keeping this record"
                                    : "Keep this record"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : null}

          {pendingSectionActionBusy ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
              Processing your request. Please wait...
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingSectionActionBusy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPendingSectionAction();
              }}
              disabled={pendingSectionActionBusy}
              className={
                pendingSectionAction?.kind === "mergeSections"
                  ? "bg-destructive text-white! hover:bg-destructive/90"
                  : ""
              }
            >
              {pendingSectionActionBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : pendingSectionAction?.kind === "linkAcademicTerms" ? (
                "Link Academic Terms"
              ) : (
                "Continue"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(selectedSectionDetail)}
        onOpenChange={(open) => !open && setSelectedSectionDetail(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSectionDetail?.label ?? "Section Details"}
            </DialogTitle>
            <DialogDescription>
              View the selected section group details.
            </DialogDescription>
          </DialogHeader>

          {selectedSectionDetail ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Section
                  </div>
                  <div className="font-medium wrap-break-word">
                    {selectedSectionDetail.label}
                  </div>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Scope
                  </div>
                  <div className="wrap-break-word">
                    {selectedSectionDetail.scopeSummary}
                  </div>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Academic Term Coverage
                  </div>
                  <div className="wrap-break-word">
                    {selectedSectionDetailTermLabels.join(", ") ||
                      "All Academic Terms"}
                  </div>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Section Records
                  </div>
                  <div>{selectedSectionDetail.sections.length}</div>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Active Records
                  </div>
                  <div>{selectedSectionDetailActiveCount}</div>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Linked Subjects
                  </div>
                  <div>{selectedSectionDetail.linkedSubjects.length}</div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Section Records
                </div>
                <ScrollArea className="max-h-[40svh] rounded-xl border">
                  <div className="space-y-2 p-3">
                    {selectedSectionDetail.sections.map((section) => (
                      <div
                        key={section.$id}
                        className="rounded-lg border px-3 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-medium wrap-break-word">
                              {buildSectionDisplayLabel(vm, section)}
                            </div>
                            <div className="text-xs text-muted-foreground wrap-break-word">
                              {resolveSectionReferenceTermLabel(vm, section)}
                            </div>
                            <div className="text-xs text-muted-foreground wrap-break-word">
                              Linked subjects:{" "}
                              {buildSectionSubjectSummary(vm, section)}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={`rounded-full ${wrappingBadgeClassName}`}
                            >
                              Students:{" "}
                              {section.studentCount != null
                                ? section.studentCount
                                : "—"}
                            </Badge>
                            <Badge
                              variant={
                                section.isActive ? "default" : "secondary"
                              }
                              className={wrappingBadgeClassName}
                            >
                              {section.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={compactInlineButtonClassName}
                            onClick={() => {
                              vm.setSectionEditing(section);
                              vm.setSectionOpen(true);
                              setSelectedSectionDetail(null);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className={compactInlineButtonClassName}
                            onClick={() => {
                              vm.setDeleteIntent({
                                type: "section",
                                doc: section,
                              });
                              setSelectedSectionDetail(null);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedSectionDetail) return;
                openSubjectViewer({
                  title: `Subjects • ${selectedSectionDetail.label}`,
                  description:
                    "All linked subjects for this reusable section group.",
                  subjects: selectedSectionDetail.linkedSubjects,
                });
              }}
              disabled={
                !selectedSectionDetail ||
                selectedSectionDetail.linkedSubjects.length === 0
              }
            >
              Subjects
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedSectionDetail(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={missingTermDialogOpen}
        onOpenChange={setMissingTermDialogOpen}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Link Sections to Academic Terms</DialogTitle>
            <DialogDescription>
              Review the visible section groups below, then create the missing
              academic-term section records in one action.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 px-3 py-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Visible Section Groups
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {visibleGroups.length}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 px-3 py-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Academic Terms
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {academicTerms.length}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 px-3 py-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Missing Links Found
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {missingAcademicTermCount}
                </div>
              </div>
            </div>

            {missingAcademicTermGroups.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                All visible section groups already have linked records for every
                academic term.
              </div>
            ) : (
              <ScrollArea className="max-h-[60svh] rounded-xl border">
                <div className="space-y-3 p-3">
                  {missingAcademicTermGroups.map((result) => (
                    <div
                      key={result.group.key}
                      className="rounded-xl border bg-background p-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium wrap-break-word">
                              {result.group.label}
                            </div>
                            <Badge
                              variant="destructive"
                              className={wrappingBadgeClassName}
                            >
                              {result.missingTerms.length} missing
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground wrap-break-word">
                            {result.group.scopeSummary}
                          </div>
                          <div className="text-xs text-muted-foreground wrap-break-word">
                            Linked terms:{" "}
                            {result.linkedTerms.length > 0
                              ? result.linkedTerms
                                  .map((term) => term.label)
                                  .join(", ")
                              : "None"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.missingTerms.map((term) => (
                          <Badge
                            key={`${result.group.key}-${term.id}`}
                            variant="outline"
                            className={wrappingBadgeClassName}
                          >
                            {term.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMissingTermDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() =>
                requestLinkAcademicTerms(missingAcademicTermGroups)
              }
              disabled={missingAcademicTermGroups.length === 0}
            >
              Link Missing Academic Terms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectViewerOpen} onOpenChange={setSubjectViewerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{subjectViewerTitle}</DialogTitle>
            <DialogDescription>{subjectViewerDescription}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60svh] rounded-md border">
            <div className="space-y-2 p-3">
              {subjectViewerSubjects.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No linked subjects found.
                </div>
              ) : (
                subjectViewerSubjects.map((subject) => (
                  <div
                    key={subject.$id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="font-medium">
                      {subject.code} — {subject.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={
                          resolveSubjectTermId(subject)
                            ? "secondary"
                            : "outline"
                        }
                        className={wrappingBadgeClassName}
                      >
                        {resolveSubjectTermId(subject)
                          ? vm.termLabel(
                              vm.terms,
                              resolveSubjectTermId(subject),
                            )
                          : "All Academic Terms"}
                      </Badge>
                      <span>
                        {vm.programLabel(
                          vm.programs,
                          subject.programId ?? null,
                        )}
                      </span>
                      <span>
                        Semester: {String(subject.semester ?? "").trim() || "—"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubjectViewerOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </TabsContent>
  );
}