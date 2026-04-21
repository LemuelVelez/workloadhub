"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import {
  Download,
  Eye,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db";
import type { MasterDataManagementVM } from "./use-master-data";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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

type PendingSectionAction = {
  kind: "mergeSections";
  groupKeys: string[];
  groupCount: number;
  duplicateCount: number;
};

type MissingAcademicTermGroup = {
  group: SectionGroup;
  linkedTerms: Array<{ id: string; label: string }>;
  missingTerms: Array<{ id: string; label: string }>;
  currentCoverageLabel: string;
  legacyCoverageLabels: string[];
  hasLegacySectionScope: boolean;
  hasAllTermSubjectCoverage: boolean;
};

type SectionPdfPreviewTarget = {
  mode: "overall" | "individual";
  title: string;
  groups: SectionGroup[];
};

const LEFT_LOGO_PATH = "/logo.png";
const RIGHT_LOGO_PATH = "/CCS.jpg";

const HEADER_REPUBLIC = "Republic of the Philippines";
const HEADER_INSTITUTION = "JOSE RIZAL MEMORIAL STATE UNIVERSITY";
const HEADER_SUBTITLE = "The Premier University in Zamboanga del Norte";
const HEADER_COLLEGE = "COLLEGE OF COMPUTING STUDIES";
const HEADER_DOCUMENT = "LIST OF SECTIONS";

const assetUrlCache = new Map<string, Promise<string>>();

let pdfRendererPromise: Promise<any> | null = null;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTimestamp(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}_${hh}${mi}`;
}

function formatDateTimeAmPm(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = d.getHours();
    const mi = d.getMinutes();
    const suffix = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${yyyy}-${mm}-${dd} ${h12}:${pad2(mi)} ${suffix}`;
  }
}

function sanitizeFilenamePart(value: unknown) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return sanitized || "sections";
}

async function loadPdfRenderer() {
  if (!pdfRendererPromise) {
    pdfRendererPromise = import("@react-pdf/renderer").then(
      (module: any) => module?.default ?? module,
    );
  }

  return pdfRendererPromise;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file data."));
    reader.readAsDataURL(blob);
  });
}

function isSvgAsset(path: string, blob: Blob) {
  return /\.svg(?:$|\?)/i.test(path) || /image\/svg\+xml/i.test(blob.type);
}

async function loadImageElement(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode image asset."));
    image.src = src;
  });
}

async function rasterizeSvgBlobToPngDataUrl(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageElement(objectUrl);
    const width = Math.max(image.naturalWidth || image.width || 1, 1);
    const height = Math.max(image.naturalHeight || image.height || 1, 1);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to prepare canvas for SVG conversion.");
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function assetBlobToPdfDataUrl(path: string, blob: Blob) {
  if (isSvgAsset(path, blob)) {
    return await rasterizeSvgBlobToPngDataUrl(blob);
  }

  return await blobToDataUrl(blob);
}

function getAssetAsDataUrl(path: string) {
  if (!assetUrlCache.has(path)) {
    const promise = (async () => {
      try {
        const response = await fetch(path, { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`Failed to load asset: ${path}`);
        }

        const blob = await response.blob();
        return await assetBlobToPdfDataUrl(path, blob);
      } catch (error) {
        assetUrlCache.delete(path);
        throw error;
      }
    })();

    assetUrlCache.set(path, promise);
  }

  return assetUrlCache.get(path)!;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

function resolveStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => String(item ?? "").trim()));
  }

  if (typeof value === "string") {
    return uniqueStrings(value.split(","));
  }

  return [] as string[];
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

function normalizeSectionCoverageLabel(value?: string | null) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  if (/^(?:—|-|–|n\/a|na|null|none)$/i.test(normalized)) return "";

  return normalized;
}

function normalizeCoverageComparisonValue(value?: string | null) {
  return normalizeSectionCoverageLabel(value).toUpperCase();
}

function isAllAcademicTermsCoverageLabel(value?: string | null) {
  const normalized = normalizeCoverageComparisonValue(value);
  return (
    normalized === "ALL ACADEMIC TERMS" ||
    normalized === "ALL TERMS" ||
    normalized === "ALL TERM"
  );
}

function resolveSectionStoredTermIds(
  academicTerms: Array<{ id: string; label: string; raw: any }>,
  section: any,
) {
  const directIds = uniqueStrings([
    String(section?.termId ?? "").trim(),
    ...resolveStringArray(section?.termIds),
  ]);

  if (directIds.length > 0) return directIds;

  const storedLabels = uniqueStrings([
    normalizeSectionCoverageLabel(section?.academicTermLabel),
    normalizeSectionCoverageLabel(section?.semester),
  ]);
  if (storedLabels.length === 0) return [];

  const normalizedStoredLabels = new Set(
    storedLabels.map((label) => normalizeCoverageComparisonValue(label)),
  );

  return academicTerms
    .filter((term) => {
      const rawSemester = normalizeSectionCoverageLabel(term?.raw?.semester);
      return (
        normalizedStoredLabels.has(normalizeCoverageComparisonValue(term.label)) ||
        normalizedStoredLabels.has(normalizeCoverageComparisonValue(rawSemester))
      );
    })
    .map((term) => term.id);
}

function extractSectionYearNumber(value?: string | number | null) {
  const normalized = normalizeSectionYearLevelValue(value);
  if (!normalized) return "";

  const prefixedMatch = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/);
  if (prefixedMatch) return prefixedMatch[1];

  const directMatch = normalized.match(/^([1-9]\d*)$/);
  if (directMatch) return directMatch[1];

  const trailingMatch = normalized.match(/([1-9]\d*)$/);
  return trailingMatch?.[1] ?? "";
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
  const normalized = resolveStringArray(section.subjectIds);

  if (normalized.length > 0) return normalized;

  const fallback = String(section.subjectId ?? "").trim();
  return fallback ? [fallback] : [];
}

function resolveSubjectProgramIds(subject?: {
  programId?: string | null;
  programIds?: string[] | string | null;
}) {
  const normalized = resolveStringArray(subject?.programIds);
  if (normalized.length > 0) return normalized;

  const fallback = String(subject?.programId ?? "").trim();
  return fallback ? [fallback] : [];
}

function resolveSubjectYearLevels(subject?: {
  yearLevel?: string | number | null;
  yearLevels?: Array<string | number> | string | null;
}) {
  const arrayValues = Array.isArray(subject?.yearLevels)
    ? subject?.yearLevels
    : typeof subject?.yearLevels === "string"
      ? subject.yearLevels.split(",")
      : [];

  const normalized = uniqueStrings(
    arrayValues.map((value) => extractSectionYearNumber(value) || String(value ?? "").trim()),
  );
  if (normalized.length > 0) return normalized;

  const fallback =
    extractSectionYearNumber(subject?.yearLevel) ||
    normalizeSectionYearLevelValue(subject?.yearLevel);
  return fallback ? [fallback] : [];
}

function resolveSubjectSectionIds(subject?: any) {
  const normalized = uniqueStrings([
    ...resolveStringArray(subject?.sectionIds),
    String(subject?.sectionId ?? "").trim(),
  ]);

  return normalized;
}

function resolveSubjectLinkedSectionIds(subject?: any) {
  const normalized = uniqueStrings([
    ...resolveStringArray(subject?.linkedSectionIds),
    String(subject?.linkedSectionId ?? "").trim(),
  ]);

  return normalized;
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

  if (
    message &&
    /(sectionids|linkedsectionids|linkedsectionid|sectionid)/i.test(message) &&
    /(attribute|column|schema|unknown|invalid)/i.test(message)
  ) {
    return "Backend is missing subject section-link attributes. Run migration 019_link_sections_to_subjects_and_terms.";
  }

  return message || "Update failed.";
}

async function updateDocumentIgnoringUnknownAttributes(
  collectionId: string,
  documentId: string,
  payload: Record<string, any>,
) {
  const ignoredKeys: string[] = [];
  const nextPayload = { ...payload };

  while (true) {
    const writableKeys = Object.keys(nextPayload);
    if (writableKeys.length === 0) {
      return {
        applied: false,
        ignoredKeys,
      };
    }

    try {
      await databases.updateDocument(
        DATABASE_ID,
        collectionId,
        documentId,
        nextPayload,
      );

      return {
        applied: true,
        ignoredKeys,
      };
    } catch (error: any) {
      const message = String(error?.message ?? "").trim();
      const unknownAttributeMatch = message.match(
        /Unknown attribute:\s*"([^"]+)"/i,
      );
      const rawUnknownKey = String(unknownAttributeMatch?.[1] ?? "").trim();

      if (!rawUnknownKey) {
        throw error;
      }

      const matchedKey = writableKeys.find(
        (key) => key.toLowerCase() === rawUnknownKey.toLowerCase(),
      );

      if (!matchedKey) {
        throw error;
      }

      delete nextPayload[matchedKey];
      ignoredKeys.push(matchedKey);
    }
  }
}

function hasOwnSectionField(section: any, key: string) {
  return Boolean(section) && Object.prototype.hasOwnProperty.call(section, key);
}

function hasLegacySectionTermScope(section: any) {
  return Boolean(
    String(section?.termId ?? "").trim() ||
      normalizeSectionCoverageLabel(section?.semester) ||
      normalizeSectionCoverageLabel(section?.academicTermLabel),
  );
}

function buildSectionAllTermsUpdatePayload(section: any) {
  const payload: Record<string, null> = {};

  if (hasOwnSectionField(section, "termId")) {
    payload.termId = null;
  }

  if (hasOwnSectionField(section, "semester")) {
    payload.semester = null;
  }

  if (hasOwnSectionField(section, "academicTermLabel")) {
    payload.academicTermLabel = null;
  }

  return payload;
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

function subjectMatchesSectionScope(subject: any, section: any) {
  const sectionDepartmentId = String(section?.departmentId ?? "").trim();
  const subjectDepartmentId = String(subject?.departmentId ?? "").trim();
  if (
    sectionDepartmentId &&
    subjectDepartmentId &&
    sectionDepartmentId !== subjectDepartmentId
  ) {
    return false;
  }

  const sectionProgramId = String(section?.programId ?? "").trim();
  const subjectProgramIds = resolveSubjectProgramIds(subject);
  if (
    sectionProgramId &&
    subjectProgramIds.length > 0 &&
    !subjectProgramIds.includes(sectionProgramId)
  ) {
    return false;
  }

  const sectionYearNumber = extractSectionYearNumber(section?.yearLevel);
  const subjectYearLevels = resolveSubjectYearLevels(subject);
  if (
    sectionYearNumber &&
    subjectYearLevels.length > 0 &&
    !subjectYearLevels.includes(sectionYearNumber)
  ) {
    return false;
  }

  return true;
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

function buildSubjectScopeLinkPayload(input: {
  subject: any;
  section: any;
  term: any;
  vm: MasterDataManagementVM;
}) {
  const { subject, section, term, vm } = input;

  const sectionId = String(section?.$id ?? "").trim();
  const sectionProgramId = String(section?.programId ?? "").trim();
  const sectionDepartmentId = String(section?.departmentId ?? "").trim();
  const sectionYearLevel =
    extractSectionYearNumber(section?.yearLevel) ||
    normalizeSectionYearLevelValue(section?.yearLevel);
  const sectionSemester =
    normalizeSectionCoverageLabel(term?.semester) ||
    normalizeSectionCoverageLabel(subject?.semester) ||
    normalizeSectionCoverageLabel(section?.semester) ||
    null;
  const nextTermId =
    String(term?.$id ?? "").trim() ||
    String(subject?.termId ?? "").trim() ||
    null;

  const programIds = uniqueStrings([
    ...resolveSubjectProgramIds(subject),
    sectionProgramId,
  ]);

  const yearLevels = uniqueStrings([
    ...resolveSubjectYearLevels(subject),
    sectionYearLevel,
  ]);

  const sectionIds = uniqueStrings([
    ...resolveSubjectSectionIds(subject),
    sectionId,
  ]);

  const linkedSectionIds = uniqueStrings([
    ...resolveSubjectLinkedSectionIds(subject),
    sectionId,
  ]);

  const preferredProgramId =
    sectionProgramId ||
    getPreferredStringValue(programIds) ||
    String(subject?.programId ?? "").trim() ||
    null;

  const preferredYearLevel =
    sectionYearLevel ||
    getPreferredStringValue(yearLevels) ||
    String(subject?.yearLevel ?? "").trim() ||
    null;

  return {
    departmentId: sectionDepartmentId || String(subject?.departmentId ?? "").trim() || null,
    programId: preferredProgramId,
    programIds,
    yearLevel:
      preferredYearLevel && preferredProgramId
        ? buildStoredSectionYearLevel(vm, preferredYearLevel, preferredProgramId)
        : preferredYearLevel,
    yearLevels,
    termId: nextTermId,
    semester: sectionSemester,
    sectionId: sectionIds[0] ?? null,
    sectionIds,
    linkedSectionId: linkedSectionIds[0] ?? null,
    linkedSectionIds,
  };
}

export function MasterDataSectionsTab({ vm }: Props) {
  const [selectedGroupKeys, setSelectedGroupKeys] = React.useState<string[]>([]);

  const [missingTermDialogOpen, setMissingTermDialogOpen] =
    React.useState(false);

  const [selectedSectionDetail, setSelectedSectionDetail] =
    React.useState<SectionGroup | null>(null);

  const [sectionPdfPreviewTarget, setSectionPdfPreviewTarget] =
    React.useState<SectionPdfPreviewTarget | null>(null);
  const [sectionPdfBusy, setSectionPdfBusy] = React.useState(false);
  const [sectionPdfPreviewBusy, setSectionPdfPreviewBusy] =
    React.useState(false);
  const [sectionPdfUrl, setSectionPdfUrl] = React.useState<string | null>(null);
  const sectionPdfUrlRef = React.useRef<string | null>(null);

  const [subjectViewerOpen, setSubjectViewerOpen] = React.useState(false);
  const [subjectViewerTitle, setSubjectViewerTitle] =
    React.useState("Linked Subjects");
  const [, setSubjectViewerDescription] = React.useState("");
  const [subjectViewerSubjects, setSubjectViewerSubjects] = React.useState<
    any[]
  >([]);

  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkDialogTitle, setLinkDialogTitle] =
    React.useState("Link Sections to Subjects and Academic Term");
  const [, setLinkDialogDescription] = React.useState("");
  const [linkTargetGroupKeys, setLinkTargetGroupKeys] = React.useState<string[]>(
    [],
  );
  const [linkTargetTermIds, setLinkTargetTermIds] = React.useState<string[]>([]);
  const [linkSelectedSubjectIds, setLinkSelectedSubjectIds] = React.useState<
    string[]
  >([]);
  const [linkUpdating, setLinkUpdating] = React.useState(false);

  const [selectedSectionDeleteDialogOpen, setSelectedSectionDeleteDialogOpen] =
    React.useState(false);
  const [selectedSectionDeleteSubmitting, setSelectedSectionDeleteSubmitting] =
    React.useState(false);

  const [sectionDedupeBusy, setSectionDedupeBusy] = React.useState(false);
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
      .map(([key, sections]) => {
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
      })
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [sortedSections, vm]);

  const visibleGroupKeySet = React.useMemo(
    () => new Set(visibleGroups.map((group) => group.key)),
    [visibleGroups],
  );

  React.useEffect(() => {
    setSelectedGroupKeys((current) =>
      current.filter((key) => visibleGroupKeySet.has(key)),
    );
  }, [visibleGroupKeySet]);

  const selectedVisibleGroups = React.useMemo(
    () =>
      visibleGroups.filter((group) => selectedGroupKeys.includes(group.key)),
    [selectedGroupKeys, visibleGroups],
  );

  const selectedSectionRecords = React.useMemo(() => {
    const seen = new Set<string>();

    return selectedVisibleGroups.flatMap((group) =>
      group.sections.filter((section) => {
        const sectionId = String(section?.$id ?? "").trim();
        if (!sectionId || seen.has(sectionId)) return false;
        seen.add(sectionId);
        return true;
      }),
    );
  }, [selectedVisibleGroups]);

  const selectedSectionDeletePreview = React.useMemo(
    () =>
      selectedVisibleGroups
        .slice(0, 3)
        .map((group) => group.label)
        .join(", "),
    [selectedVisibleGroups],
  );

  const allSectionGroups = React.useMemo<SectionGroup[]>(() => {
    const grouped = new Map<string, any[]>();

    for (const section of vm.sections) {
      const key = buildSectionGroupKey(vm, section);
      const current = grouped.get(key) || [];
      current.push(section);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .map(([key, sections]) => {
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
      })
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [vm]);

  const allDuplicateSectionGroups = React.useMemo(
    () => allSectionGroups.filter((group) => group.sections.length > 1),
    [allSectionGroups],
  );

  const pendingMergeSectionGroups = React.useMemo(
    () =>
      pendingSectionAction?.kind === "mergeSections"
        ? allSectionGroups.filter((group) =>
            pendingSectionAction.groupKeys.includes(group.key),
          )
        : [],
    [allSectionGroups, pendingSectionAction],
  );

  const pendingSectionActionBusy =
    pendingSectionActionSubmitting || sectionDedupeBusy;

  const academicTerms = React.useMemo(
    () =>
      vm.terms
        .map((term) => ({
          id: String(term?.$id ?? "").trim(),
          label: resolveAcademicTermLabel(vm, term),
          raw: term,
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
          const hasLegacySectionScope = group.sections.some((section) =>
            hasLegacySectionTermScope(section),
          );

          const linkedTerms = uniqueStrings(
            group.sections.flatMap((section) =>
              resolveSectionStoredTermIds(academicTerms, section),
            ),
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

          const legacyCoverageLabels = uniqueStrings(
            group.sections.flatMap((section) => [
              normalizeSectionCoverageLabel(section?.academicTermLabel),
              normalizeSectionCoverageLabel(vm.termLabel(vm.terms, section?.termId)),
              normalizeSectionCoverageLabel(section?.semester),
              ...resolveStringArray(section?.termLabels),
            ]),
          );

          const hasAllTermSubjectCoverage =
            !hasLegacySectionScope ||
            legacyCoverageLabels.some((label) =>
              isAllAcademicTermsCoverageLabel(label),
            ) ||
            linkedTerms.length === 0;

          const missingTerms = hasAllTermSubjectCoverage
            ? []
            : academicTerms
                .filter(
                  (term) =>
                    !linkedTerms.some((linkedTerm) => linkedTerm.id === term.id),
                )
                .map((term) => ({ id: term.id, label: term.label }));

          return {
            group,
            linkedTerms,
            missingTerms,
            currentCoverageLabel: hasAllTermSubjectCoverage
              ? "All Academic Terms"
              : linkedTerms.length > 0
                ? linkedTerms.map((term) => term.label).join(", ")
                : legacyCoverageLabels.join(", ") || "All Academic Terms",
            hasAllTermSubjectCoverage,
            hasLegacySectionScope,
            legacyCoverageLabels:
              hasAllTermSubjectCoverage && legacyCoverageLabels.length === 0
                ? ["All Academic Terms"]
                : legacyCoverageLabels,
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

  const allVisibleSelected =
    visibleGroups.length > 0 && selectedGroupKeys.length === visibleGroups.length;
  const someVisibleSelected =
    selectedGroupKeys.length > 0 && selectedGroupKeys.length < visibleGroups.length;

  const toggleVisibleSelection = React.useCallback(
    (checked: boolean) => {
      setSelectedGroupKeys(checked ? visibleGroups.map((group) => group.key) : []);
    },
    [visibleGroups],
  );

  const toggleGroupSelection = React.useCallback((groupKey: string, checked: boolean) => {
    setSelectedGroupKeys((current) =>
      checked
        ? Array.from(new Set([...current, groupKey]))
        : current.filter((key) => key !== groupKey),
    );
  }, []);

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

  const openSubjectViewer = React.useCallback(
    (config: { title: string; description: string; subjects: any[] }) => {
      setSubjectViewerTitle(config.title);
      setSubjectViewerDescription(config.description);
      setSubjectViewerSubjects(config.subjects);
      setSubjectViewerOpen(true);
    },
    [],
  );

  const openLinkDialog = React.useCallback(
    (config: {
      title: string;
      description: string;
      groupKeys: string[];
      initialSubjectIds?: string[];
      initialTermIds?: string[];
    }) => {
      const normalizedGroupKeys = uniqueStrings(config.groupKeys);
      if (normalizedGroupKeys.length === 0) {
        toast.error("No section groups selected.");
        return;
      }

      setLinkDialogTitle(config.title);
      setLinkDialogDescription(config.description);
      setLinkTargetGroupKeys(normalizedGroupKeys);
      setLinkSelectedSubjectIds(uniqueStrings(config.initialSubjectIds ?? []));
      setLinkTargetTermIds(uniqueStrings(config.initialTermIds ?? []));
      setLinkDialogOpen(true);
    },
    [],
  );

  const openLinkSelectedSectionsDialog = React.useCallback(() => {
    const targetGroups = selectedVisibleGroups.length > 0 ? selectedVisibleGroups : visibleGroups;
    if (targetGroups.length === 0) {
      toast.error("No visible section groups found.");
      return;
    }

    openLinkDialog({
      title:
        selectedVisibleGroups.length > 0
          ? "Link Selected Sections"
          : "Link All Visible Sections",
      description:
        selectedVisibleGroups.length > 0
          ? "Link the selected section groups to subjects and one or more academic terms."
          : "Link all visible section groups to subjects and one or more academic terms.",
      groupKeys: targetGroups.map((group) => group.key),
      initialSubjectIds: uniqueStrings(
        targetGroups.flatMap((group) => group.uniqueSubjectIds),
      ),
    });
  }, [openLinkDialog, selectedVisibleGroups, visibleGroups]);

  const editSelectedSectionGroup = React.useCallback(() => {
    if (selectedSectionRecords.length === 0) {
      toast.error("Select at least one section group to edit.");
      return;
    }

    const targetSection = selectedSectionRecords[0];
    if (!targetSection) {
      toast.error("No section record found for the selected groups.");
      return;
    }

    vm.resetSectionDirtyFields();

    if (selectedSectionRecords.length === 1) {
      vm.setSectionEditingBatch([]);
      vm.setSectionEditing(targetSection);
    } else {
      vm.setSectionEditing(null);
      vm.setSectionEditingBatch(selectedSectionRecords);
    }

    vm.setSectionOpen(true);
  }, [selectedSectionRecords, vm]);

  const openDeleteSelectedSectionsDialog = React.useCallback(() => {
    if (selectedVisibleGroups.length === 0) {
      toast.error("Please select at least one section group to delete.");
      return;
    }

    setSelectedSectionDeleteDialogOpen(true);
  }, [selectedVisibleGroups.length]);

  const deleteSelectedSections = React.useCallback(async () => {
    if (selectedSectionDeleteSubmitting || selectedSectionRecords.length === 0) {
      return;
    }

    setSelectedSectionDeleteSubmitting(true);
    try {
      let deleted = 0;
      const failed: string[] = [];

      for (const section of selectedSectionRecords) {
        try {
          await databases.deleteDocument(
            DATABASE_ID,
            COLLECTIONS.SECTIONS,
            section.$id,
          );
          deleted += 1;
        } catch (error: any) {
          failed.push(
            `${buildSectionDisplayLabel(vm, section)} (${formatSectionBulkEditError(error)})`,
          );
        }
      }

      if (deleted > 0) {
        const deletedGroupKeySet = new Set(
          selectedVisibleGroups.map((group) => group.key),
        );

        await vm.refreshAll();
        setSelectedGroupKeys((current) =>
          current.filter((key) => !deletedGroupKeySet.has(key)),
        );
        setSelectedSectionDetail((current) =>
          current && deletedGroupKeySet.has(current.key) ? null : current,
        );
      }

      if (failed.length === 0) {
        toast.success(
          `Deleted ${deleted} section record${deleted === 1 ? "" : "s"} from ${selectedVisibleGroups.length} selected group${selectedVisibleGroups.length === 1 ? "" : "s"}.`,
        );
        setSelectedSectionDeleteDialogOpen(false);
        return;
      }

      if (deleted > 0) {
        toast.error(
          `Deleted ${deleted} section record${deleted === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`,
        );
        setSelectedSectionDeleteDialogOpen(false);
        return;
      }

      toast.error(
        `Failed to delete selected sections: ${failed.join(", ") || "No section records found."}`,
      );
    } finally {
      setSelectedSectionDeleteSubmitting(false);
    }
  }, [
    selectedSectionDeleteSubmitting,
    selectedSectionRecords,
    selectedVisibleGroups,
    vm,
  ]);

  const linkTargetGroups = React.useMemo(
    () =>
      visibleGroups.filter((group) => linkTargetGroupKeys.includes(group.key)),
    [linkTargetGroupKeys, visibleGroups],
  );

  const linkTargetSections = React.useMemo(
    () => linkTargetGroups.flatMap((group) => group.sections),
    [linkTargetGroups],
  );

  const linkTargetTerms = React.useMemo(
    () =>
      academicTerms
        .filter((term) => linkTargetTermIds.includes(term.id))
        .map((term) => term.raw),
    [academicTerms, linkTargetTermIds],
  );

  const linkTargetTermIdSet = React.useMemo(
    () => new Set(linkTargetTermIds),
    [linkTargetTermIds],
  );

  const linkSelectedAcademicTerms = React.useMemo(
    () => academicTerms.filter((term) => linkTargetTermIds.includes(term.id)),
    [academicTerms, linkTargetTermIds],
  );

  const allLinkTermsSelected =
    academicTerms.length > 0 &&
    linkSelectedAcademicTerms.length === academicTerms.length;

  const someLinkTermsSelected =
    linkSelectedAcademicTerms.length > 0 && !allLinkTermsSelected;

  const toggleAllLinkTerms = React.useCallback(
    (checked: boolean) => {
      setLinkTargetTermIds(checked ? academicTerms.map((term) => term.id) : []);
    },
    [academicTerms],
  );

  const toggleLinkTargetTerm = React.useCallback((termId: string, checked: boolean) => {
    setLinkTargetTermIds((current) =>
      checked
        ? Array.from(new Set([...current, termId]))
        : current.filter((id) => id !== termId),
    );
  }, []);

  const linkCandidateSubjects = React.useMemo(() => {
    const sections = linkTargetSections;
    if (sections.length === 0) return [] as any[];

    return vm.subjects
      .filter((subject) => {
        if (!sections.some((section) => subjectMatchesSectionScope(subject, section))) {
          return false;
        }

        const subjectTermId = resolveSubjectTermId(subject);
        if (linkTargetTermIdSet.size === 0) {
          return true;
        }

        return !subjectTermId || linkTargetTermIdSet.has(subjectTermId);
      })
      .sort((a, b) =>
        `${a?.code} ${a?.title}`.localeCompare(`${b?.code} ${b?.title}`),
      );
  }, [linkTargetSections, linkTargetTermIdSet, vm.subjects]);

  const linkAllCandidateSubjectIds = React.useMemo(
    () => linkCandidateSubjects.map((subject) => String(subject.$id)),
    [linkCandidateSubjects],
  );

  React.useEffect(() => {
    setLinkSelectedSubjectIds((current) =>
      current.filter((subjectId) => linkAllCandidateSubjectIds.includes(subjectId)),
    );
  }, [linkAllCandidateSubjectIds]);

  const allLinkCandidatesSelected =
    linkCandidateSubjects.length > 0 &&
    linkAllCandidateSubjectIds.every((subjectId) =>
      linkSelectedSubjectIds.includes(subjectId),
    );

  const someLinkCandidatesSelected =
    linkSelectedSubjectIds.length > 0 && !allLinkCandidatesSelected;

  const toggleAllLinkCandidates = React.useCallback((checked: boolean) => {
    setLinkSelectedSubjectIds(checked ? linkAllCandidateSubjectIds : []);
  }, [linkAllCandidateSubjectIds]);

  const toggleLinkSubject = React.useCallback((subjectId: string, checked: boolean) => {
    setLinkSelectedSubjectIds((current) =>
      checked
        ? Array.from(new Set([...current, subjectId]))
        : current.filter((id) => id !== subjectId),
    );
  }, []);

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
      const groups = allSectionGroups.filter((group) =>
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
    allSectionGroups,
    mergeSectionGroups,
    pendingSectionAction,
    pendingSectionActionSubmitting,
    sectionMergeKeepByGroup,
  ]);

  const linkVisibleSectionGroupsAcrossAllTerms = React.useCallback(
    async (groups: MissingAcademicTermGroup[]) => {
      if (groups.length === 0) {
        toast.success(
          "All visible section groups already have academic-term coverage.",
        );
        return;
      }

      openLinkDialog({
        title: "Link Visible Sections to Academic Terms",
        description:
          "Select one or more academic terms, then choose the subject records that should cover the missing academic-term links for the visible section groups.",
        groupKeys: groups.map((result) => result.group.key),
        initialSubjectIds: uniqueStrings(
          groups.flatMap((result) => result.group.uniqueSubjectIds),
        ),
        initialTermIds: uniqueStrings(
          groups.flatMap((result) =>
            result.missingTerms.map((term) => term.id),
          ),
        ),
      });
      setMissingTermDialogOpen(false);
    },
    [openLinkDialog],
  );

  const saveSectionSubjectAndTermLinks = React.useCallback(async () => {
    const targetGroups = linkTargetGroups;
    const targetSections = linkTargetSections;
    const selectedSubjectIds = uniqueStrings(linkSelectedSubjectIds);
    const selectedTermIds = uniqueStrings(linkTargetTermIds);

    if (targetGroups.length === 0 || targetSections.length === 0) {
      toast.error("No section groups selected for linking.");
      return;
    }

    if (selectedTermIds.length === 0) {
      toast.error("Please select at least one academic term.");
      return;
    }

    if (selectedSubjectIds.length === 0) {
      toast.error("Please select at least one subject.");
      return;
    }

    const subjectById = new Map<string, any>(
      vm.subjects.map((subject) => [String(subject.$id), subject]),
    );
    const selectedTermById = new Map(
      linkTargetTerms.map((term) => [String(term?.$id ?? "").trim(), term]),
    );
    const selectedTermSummary =
      linkSelectedAcademicTerms.length === 1
        ? linkSelectedAcademicTerms[0]?.label ?? "1 academic term"
        : `${linkSelectedAcademicTerms.length} academic terms`;

    setLinkUpdating(true);
    try {
      let updatedSections = 0;
      let updatedSubjects = 0;
      let skippedSections = 0;
      const failed: string[] = [];

      for (const section of targetSections) {
        try {
          const updateResult = await updateDocumentIgnoringUnknownAttributes(
            COLLECTIONS.SECTIONS,
            section.$id,
            {
              subjectId: selectedSubjectIds[0] ?? null,
              subjectIds: selectedSubjectIds,
              ...buildSectionAllTermsUpdatePayload(section),
            },
          );

          if (updateResult.applied) {
            updatedSections += 1;
          } else {
            skippedSections += 1;
          }
        } catch (error: any) {
          failed.push(
            `${buildSectionDisplayLabel(vm, section)} (${formatSectionBulkEditError(error)})`,
          );
        }
      }

      for (const subjectId of selectedSubjectIds) {
        const subject = subjectById.get(subjectId);
        if (!subject) {
          failed.push(`Subject ${subjectId} (not found)`);
          continue;
        }

        try {
          const subjectTermId = resolveSubjectTermId(subject);
          const preferredTerm = subjectTermId
            ? selectedTermById.get(subjectTermId) ?? null
            : linkTargetTerms.length === 1
              ? linkTargetTerms[0] ?? null
              : null;

          const payload = targetSections.reduce(
            (currentPayload, section) => ({
              ...currentPayload,
              ...buildSubjectScopeLinkPayload({
                subject: { ...subject, ...currentPayload },
                section,
                term: preferredTerm,
                vm,
              }),
            }),
            {} as Record<string, any>,
          );

          const updateResult = await updateDocumentIgnoringUnknownAttributes(
            COLLECTIONS.SUBJECTS,
            subjectId,
            payload,
          );

          if (updateResult.applied) {
            updatedSubjects += 1;
          }
        } catch (error: any) {
          failed.push(
            `${String(subject?.code ?? subjectId)} (${formatSectionBulkEditError(error)})`,
          );
        }
      }

      if (updatedSections > 0 || updatedSubjects > 0) {
        await vm.refreshAll();
      }

      if (failed.length === 0) {
        toast.success(
          `Linked ${updatedSections} section record${updatedSections === 1 ? "" : "s"}, ${updatedSubjects} subject${updatedSubjects === 1 ? "" : "s"}, and applied ${selectedTermSummary}${skippedSections > 0 ? ` while skipping ${skippedSections} section record${skippedSections === 1 ? "" : "s"} with no writable legacy term fields` : ""}.`,
        );
        setLinkDialogOpen(false);
        return;
      }

      if (updatedSections > 0 || updatedSubjects > 0) {
        toast.error(
          `Saved section and subject links with some failures: ${failed.join(", ")}`,
        );
        return;
      }

      toast.error(
        failed.length > 0
          ? `Failed to link sections and subjects: ${failed.join(", ")}`
          : "No section or subject links were updated.",
      );
    } finally {
      setLinkUpdating(false);
    }
  }, [
    linkSelectedAcademicTerms,
    linkSelectedSubjectIds,
    linkTargetGroups,
    linkTargetSections,
    linkTargetTermIds,
    linkTargetTerms,
    vm,
  ]);

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

  const selectedSectionPreviewRows = React.useMemo(
    () =>
      sectionPdfPreviewTarget
        ? sectionPdfPreviewTarget.groups.flatMap((group) =>
            group.sections.map((section) => ({
              id: String(section?.$id ?? "").trim() || `${group.key}-${group.label}`,
              groupLabel: group.label,
              sectionLabel: buildSectionDisplayLabel(vm, section),
              scopeSummary: group.scopeSummary,
              academicTermCoverage: resolveSectionReferenceTermLabel(vm, section),
              linkedSubjects: buildSectionSubjectSummary(vm, section),
              studentCount:
                section?.studentCount != null &&
                String(section.studentCount).trim() !== ""
                  ? String(section.studentCount)
                  : "—",
              status: section?.isActive ? "Active" : "Inactive",
            })),
          )
        : [],
    [sectionPdfPreviewTarget, vm],
  );

  const selectedSectionPreviewTermLabels = React.useMemo(
    () =>
      sectionPdfPreviewTarget
        ? uniqueStrings(
            sectionPdfPreviewTarget.groups.flatMap((group) =>
              group.sections.map((section) =>
                resolveSectionReferenceTermLabel(vm, section),
              ),
            ),
          )
        : [],
    [sectionPdfPreviewTarget, vm],
  );

  const resetSectionPdfPreviewUrl = React.useCallback(() => {
    if (sectionPdfUrlRef.current) {
      URL.revokeObjectURL(sectionPdfUrlRef.current);
      sectionPdfUrlRef.current = null;
    }

    setSectionPdfUrl(null);
    setSectionPdfPreviewBusy(false);
  }, []);

  const openOverallSectionPreview = React.useCallback(() => {
    if (visibleGroups.length === 0) {
      toast.error("No visible section groups found.");
      return;
    }

    resetSectionPdfPreviewUrl();
    setSectionPdfPreviewTarget({
      mode: "overall",
      title: "Overall Section Preview",
      groups: visibleGroups,
    });
  }, [resetSectionPdfPreviewUrl, visibleGroups]);

  const openIndividualSectionPreview = React.useCallback(
    (group: SectionGroup) => {
      resetSectionPdfPreviewUrl();
      setSectionPdfPreviewTarget({
        mode: "individual",
        title: group.label,
        groups: [group],
      });
    },
    [resetSectionPdfPreviewUrl],
  );

  const buildSectionPdfBlob = React.useCallback(
    async (target: SectionPdfPreviewTarget) => {
      const pdfRows = target.groups.flatMap((group) =>
        group.sections.map((section) => ({
          id: String(section?.$id ?? "").trim() || `${group.key}-${group.label}`,
          groupLabel: group.label,
          sectionLabel: buildSectionDisplayLabel(vm, section),
          scopeSummary: group.scopeSummary,
          academicTermCoverage: resolveSectionReferenceTermLabel(vm, section),
          linkedSubjects: buildSectionSubjectSummary(vm, section),
          studentCount:
            section?.studentCount != null &&
            String(section.studentCount).trim() !== ""
              ? String(section.studentCount)
              : "—",
          status: section?.isActive ? "Active" : "Inactive",
        })),
      );

      const isIndividual = target.mode === "individual";
      const generatedAt = new Date();

      const filename = isIndividual
        ? `list-of-sections_${sanitizeFilenamePart(target.title)}_${formatTimestamp(generatedAt)}.pdf`
        : `list-of-sections_overall_${formatTimestamp(generatedAt)}.pdf`;

      const subtitle = isIndividual
        ? `Section: ${target.title}`
        : `Overall Preview: ${target.groups.length} section group${target.groups.length === 1 ? "" : "s"}`;

      const generatedLabel = `Generated at: ${formatDateTimeAmPm(generatedAt)}`;

      const m: any = await loadPdfRenderer();
      const Document = m.Document as any;
      const Page = m.Page as any;
      const Text = m.Text as any;
      const View = m.View as any;
      const Image = m.Image as any;
      const StyleSheet = m.StyleSheet as any;
      const pdf = m.pdf as any;

      const [leftLogoSrc, rightLogoSrc] = await Promise.all([
        getAssetAsDataUrl(LEFT_LOGO_PATH),
        getAssetAsDataUrl(RIGHT_LOGO_PATH),
      ]);

      const cols = isIndividual
        ? ([
            { key: "academicTermCoverage", label: "Academic Term Coverage", w: "18%" },
            { key: "linkedSubjects", label: "Linked Subjects", w: "42%" },
            { key: "studentCount", label: "Students", w: "10%" },
            { key: "status", label: "Status", w: "10%" },
            { key: "scopeSummary", label: "Scope", w: "20%" },
          ] as const)
        : ([
            { key: "sectionLabel", label: "Section", w: "18%" },
            { key: "scopeSummary", label: "Scope", w: "17%" },
            { key: "academicTermCoverage", label: "Academic Term Coverage", w: "16%" },
            { key: "linkedSubjects", label: "Linked Subjects", w: "31%" },
            { key: "studentCount", label: "Students", w: "8%" },
            { key: "status", label: "Status", w: "10%" },
          ] as const);

      const styles = StyleSheet.create({
        page: {
          paddingTop: 18,
          paddingRight: 22,
          paddingBottom: 36,
          paddingLeft: 22,
          fontFamily: "Helvetica",
          color: "#1F2937",
          fontSize: 8.5,
        },
        headerWrap: {
          width: "100%",
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        },
        logoWrap: {
          width: 72,
          height: 60,
          alignItems: "center",
          justifyContent: "center",
        },
        logo: {
          width: 54,
          height: 54,
          objectFit: "contain",
        },
        centerHeader: {
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 6,
        },
        republic: {
          fontSize: 7,
          color: "#4B5563",
          textAlign: "center",
          marginBottom: 1,
        },
        school: {
          fontSize: 10.5,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 1,
        },
        campusLine: {
          fontSize: 7.2,
          color: "#4B5563",
          textAlign: "center",
          marginBottom: 4,
        },
        college: {
          fontSize: 9.25,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 1,
        },
        documentTitle: {
          fontSize: 15.5,
          fontStyle: "italic",
          textAlign: "center",
          color: "#4B5563",
          marginTop: 8,
          marginBottom: 2,
        },
        metaCenter: {
          fontSize: 8.1,
          textAlign: "center",
          color: "#475569",
          marginBottom: 1,
        },
        table: {
          marginTop: 10,
          borderWidth: 1,
          borderColor: "#CBD5E1",
        },
        headerRowTable: {
          flexDirection: "row",
          backgroundColor: "#0F172A",
        },
        headerCell: {
          padding: 6,
          color: "#FFFFFF",
          fontWeight: "bold",
          borderRightWidth: 1,
          borderRightColor: "#CBD5E1",
          textAlign: "center",
        },
        row: {
          flexDirection: "row",
        },
        cell: {
          padding: 6,
          borderTopWidth: 1,
          borderTopColor: "#CBD5E1",
          borderRightWidth: 1,
          borderRightColor: "#CBD5E1",
          color: "#0F172A",
        },
        zebra: {
          backgroundColor: "#F8FAFC",
        },
        footerText: {
          position: "absolute",
          bottom: 12,
          left: 22,
          right: 22,
          flexDirection: "row",
          justifyContent: "space-between",
          fontSize: 8,
          color: "#64748B",
        },
        footerRuleWrap: {
          position: "absolute",
          bottom: 24,
          left: 22,
          right: 22,
        },
        blueRule: {
          height: 2,
          backgroundColor: "#7FA7E8",
          width: "100%",
        },
        goldRule: {
          height: 1.5,
          backgroundColor: "#E9C76B",
          width: "100%",
          marginTop: 2,
        },
      });

      const SectionPdfDocument = () => (
        <Document title={`${HEADER_DOCUMENT}${isIndividual ? ` - ${target.title}` : ""}`}>
          <Page size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.headerWrap}>
              <View style={styles.headerRow}>
                <View style={styles.logoWrap}>
                  <Image src={leftLogoSrc} style={styles.logo} />
                </View>

                <View style={styles.centerHeader}>
                  <Text style={styles.republic}>{HEADER_REPUBLIC}</Text>
                  <Text style={styles.school}>{HEADER_INSTITUTION}</Text>
                  <Text style={styles.campusLine}>{HEADER_SUBTITLE}</Text>
                  <Text style={styles.college}>{HEADER_COLLEGE}</Text>
                </View>

                <View style={styles.logoWrap}>
                  <Image src={rightLogoSrc} style={styles.logo} />
                </View>
              </View>
            </View>

            <Text style={styles.documentTitle}>{HEADER_DOCUMENT}</Text>
            <Text style={styles.metaCenter}>{subtitle}</Text>
            <Text style={styles.metaCenter}>{generatedLabel}</Text>

            <View style={styles.table}>
              <View style={styles.headerRowTable} wrap={false}>
                {cols.map((column, index) => (
                  <View
                    key={column.key}
                    style={{
                      width: column.w,
                      borderRightWidth: index === cols.length - 1 ? 0 : 1,
                      borderRightColor: "#CBD5E1",
                    }}
                  >
                    <Text
                      style={[
                        styles.headerCell,
                        {
                          borderRightWidth: 0,
                          textAlign:
                            column.key === "studentCount" || column.key === "status"
                              ? "center"
                              : "left",
                        },
                      ]}
                    >
                      {column.label}
                    </Text>
                  </View>
                ))}
              </View>

              {pdfRows.map((row, index) => {
                const zebra = index % 2 === 0 ? undefined : styles.zebra;

                return (
                  <View key={row.id || `${row.groupLabel}-${index}`} style={[styles.row, zebra]} wrap={false}>
                    {cols.map((column, columnIndex) => {
                      const value = String(row[column.key] ?? "—");
                      const isLast = columnIndex === cols.length - 1;

                      return (
                        <View
                          key={column.key}
                          style={{
                            width: column.w,
                            borderRightWidth: isLast ? 0 : 1,
                            borderRightColor: "#CBD5E1",
                          }}
                        >
                          <Text
                            style={[
                              styles.cell,
                              {
                                borderRightWidth: 0,
                                textAlign:
                                  column.key === "studentCount" || column.key === "status"
                                    ? "center"
                                    : "left",
                                fontWeight:
                                  column.key === "status" ? "bold" : "normal",
                                color:
                                  column.key === "status"
                                    ? value === "Active"
                                      ? "#065F46"
                                      : "#7C2D12"
                                    : "#0F172A",
                              },
                            ]}
                          >
                            {value}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            <View style={styles.footerRuleWrap} fixed>
              <View style={styles.blueRule} />
              <View style={styles.goldRule} />
            </View>

            <View style={styles.footerText} fixed>
              <Text>
                {pdfRows.length} section record{pdfRows.length === 1 ? "" : "s"}
              </Text>
              <Text>WorkloadHub</Text>
            </View>
          </Page>
        </Document>
      );

      const blob: Blob = await pdf(<SectionPdfDocument />).toBlob();
      return { blob, filename };
    },
    [vm],
  );

  const ensureSectionPdfPreview = React.useCallback(async () => {
    if (!sectionPdfPreviewTarget) return;
    if (sectionPdfUrl) return;
    if (sectionPdfPreviewBusy) return;

    setSectionPdfPreviewBusy(true);

    try {
      const { blob } = await buildSectionPdfBlob(sectionPdfPreviewTarget);
      const url = URL.createObjectURL(blob);

      if (sectionPdfUrlRef.current) {
        URL.revokeObjectURL(sectionPdfUrlRef.current);
      }

      sectionPdfUrlRef.current = url;
      setSectionPdfUrl(url);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to generate section PDF preview.");
    } finally {
      setSectionPdfPreviewBusy(false);
    }
  }, [
    buildSectionPdfBlob,
    sectionPdfPreviewBusy,
    sectionPdfPreviewTarget,
    sectionPdfUrl,
  ]);

  React.useEffect(() => {
    if (!sectionPdfPreviewTarget) {
      resetSectionPdfPreviewUrl();
      return;
    }

    void ensureSectionPdfPreview();
  }, [
    ensureSectionPdfPreview,
    resetSectionPdfPreviewUrl,
    sectionPdfPreviewTarget,
  ]);

  React.useEffect(
    () => () => {
      if (sectionPdfUrlRef.current) {
        URL.revokeObjectURL(sectionPdfUrlRef.current);
        sectionPdfUrlRef.current = null;
      }
    },
    [],
  );

  const onDownloadSectionPdf = React.useCallback(async () => {
    if (!sectionPdfPreviewTarget) {
      toast.error("No section preview is available.");
      return;
    }

    setSectionPdfBusy(true);

    try {
      const { blob, filename } = await buildSectionPdfBlob(sectionPdfPreviewTarget);
      downloadBlob(blob, filename);
      toast.success("Section PDF exported.");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to export section PDF.");
    } finally {
      setSectionPdfBusy(false);
    }
  }, [buildSectionPdfBlob, sectionPdfPreviewTarget]);

  return (
    <TabsContent value="sections" className="space-y-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="font-medium">Sections</div>
            <div className="text-sm text-muted-foreground">
              Manage reusable section records, edit or delete selected section groups,
              link selected or visible sections to subjects and academic terms, and
              clean up duplicate records.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              size="sm"
              className={compactActionButtonClassName}
              onClick={() => {
                vm.resetSectionDirtyFields();
                vm.setSectionEditingBatch([]);
                vm.setSectionEditing(null);
                vm.setSectionOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="min-w-0 truncate">Add Section</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={compactActionButtonClassName}
              onClick={openOverallSectionPreview}
              disabled={
                visibleGroups.length === 0 || sectionPdfBusy || sectionPdfPreviewBusy
              }
            >
              <Eye className="mr-2 h-4 w-4" />
              <span className="min-w-0 truncate">
                Preview Overall ({visibleGroups.length})
              </span>
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
                {visibleGroups.length} visible group
                {visibleGroups.length === 1 ? "" : "s"}
              </Badge>
              <Badge
                variant="outline"
                className={`rounded-full ${wrappingBadgeClassName}`}
              >
                {selectedVisibleGroups.length} selected
              </Badge>
              <Badge
                variant="outline"
                className={`rounded-full ${wrappingBadgeClassName}`}
              >
                {missingAcademicTermGroups.length} group
                {missingAcademicTermGroups.length === 1 ? "" : "s"} still
                using legacy term scope
              </Badge>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={compactActionButtonClassName}
                  onClick={openLinkSelectedSectionsDialog}
                  disabled={visibleGroups.length === 0}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  <span className="min-w-0 truncate">
                    {selectedVisibleGroups.length > 0
                      ? `Link Selected Sections (${selectedVisibleGroups.length})`
                      : `Link All Visible Sections (${visibleGroups.length})`}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={compactActionButtonClassName}
                  onClick={editSelectedSectionGroup}
                  disabled={selectedSectionRecords.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  <span className="min-w-0 truncate">
                    Edit Selected ({selectedVisibleGroups.length})
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className={compactActionButtonClassName}
                  onClick={openDeleteSelectedSectionsDialog}
                  disabled={
                    selectedVisibleGroups.length === 0 ||
                    selectedSectionDeleteSubmitting
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="min-w-0 truncate">
                    Delete Selected ({selectedVisibleGroups.length})
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={compactActionButtonClassName}
                  onClick={openMissingAcademicTermDialog}
                  disabled={
                    visibleGroups.length === 0 || academicTerms.length === 0
                  }
                >
                  <span className="min-w-0 truncate">
                    Review Academic Term Coverage
                  </span>
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Badge
                  variant="outline"
                  className={`rounded-full ${wrappingBadgeClassName}`}
                >
                  Applies to all academic terms
                </Badge>

                <Badge
                  variant="outline"
                  className={`rounded-full ${wrappingBadgeClassName}`}
                >
                  {missingAcademicTermGroups.length} section group
                  {missingAcademicTermGroups.length === 1 ? "" : "s"} missing{" "}
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
                      {selectedVisibleGroups.length} selected
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${wrappingBadgeClassName}`}
                    >
                      {allDuplicateSectionGroups.length} duplicate group
                      {allDuplicateSectionGroups.length === 1 ? "" : "s"} across
                      all terms
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Select groups below, then edit, delete, or link the selected
                    section groups without leaving this view.
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t px-4 pb-4 pt-4">
                <div className="space-y-3 sm:hidden">
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-3">
                    <Checkbox
                      checked={
                        allVisibleSelected
                          ? true
                          : someVisibleSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        toggleVisibleSelection(Boolean(value))
                      }
                      aria-label="Select all visible section groups"
                    />
                    <div className="text-sm font-medium">
                      Select all visible section groups
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border bg-background">
                    {visibleGroups.map((group) => {
                      const checked = selectedGroupKeys.includes(group.key);
                      return (
                        <div
                          key={group.key}
                          className="border-b px-3 py-3 last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleGroupSelection(group.key, Boolean(value))
                              }
                              aria-label={`Select ${group.label}`}
                            />

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="wrap-break-word text-sm font-medium leading-5">
                                {group.label}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {group.scopeSummary}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={compactInlineButtonClassName}
                                  onClick={() => openIndividualSectionPreview(group)}
                                  disabled={sectionPdfBusy || sectionPdfPreviewBusy}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Preview
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={compactInlineButtonClassName}
                                  onClick={() => setSelectedSectionDetail(group)}
                                >
                                  Details
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={compactInlineButtonClassName}
                                  onClick={() =>
                                    openLinkDialog({
                                      title: `Link ${group.label}`,
                                      description:
                                        "Link this section group to subjects and one or more academic terms.",
                                      groupKeys: [group.key],
                                      initialSubjectIds: group.uniqueSubjectIds,
                                    })
                                  }
                                >
                                  <Link2 className="mr-2 h-4 w-4" />
                                  Link
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
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
                      {selectedVisibleGroups.length} selected group
                      {selectedVisibleGroups.length === 1 ? "" : "s"}
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
                          <TableHead className="w-14">
                            <Checkbox
                              checked={
                                allVisibleSelected
                                  ? true
                                  : someVisibleSelected
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={(value) =>
                                toggleVisibleSelection(Boolean(value))
                              }
                              aria-label="Select all visible section groups"
                            />
                          </TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Scope</TableHead>
                          <TableHead className="w-40 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleGroups.map((group) => (
                          <TableRow key={group.key}>
                            <TableCell>
                              <Checkbox
                                checked={selectedGroupKeys.includes(group.key)}
                                onCheckedChange={(value) =>
                                  toggleGroupSelection(group.key, Boolean(value))
                                }
                                aria-label={`Select ${group.label}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="wrap-break-word">{group.label}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <div className="wrap-break-word">
                                {group.scopeSummary}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={compactInlineButtonClassName}
                                  onClick={() => openIndividualSectionPreview(group)}
                                  disabled={sectionPdfBusy || sectionPdfPreviewBusy}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Preview
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={compactInlineButtonClassName}
                                  onClick={() => setSelectedSectionDetail(group)}
                                >
                                  Details
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={compactInlineButtonClassName}
                                  onClick={() =>
                                    openLinkDialog({
                                      title: `Link ${group.label}`,
                                      description:
                                        "Link this section group to subjects and one or more academic terms.",
                                      groupKeys: [group.key],
                                      initialSubjectIds: group.uniqueSubjectIds,
                                    })
                                  }
                                >
                                  <Link2 className="mr-2 h-4 w-4" />
                                  Link
                                </Button>
                              </div>
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

      <Dialog
        open={Boolean(sectionPdfPreviewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setSectionPdfPreviewTarget(null);
          }
        }}
      >
        <DialogContent className="min-w-0 overflow-auto sm:max-w-6xl h-[95svh]">
          <DialogHeader>
            <DialogTitle>
              PDF Preview — {sectionPdfPreviewTarget?.title ?? "Sections"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {sectionPdfPreviewTarget?.mode === "individual"
                ? "Individual Section Preview"
                : "Overall Section Preview"}
            </Badge>
            <Badge variant="outline">
              {sectionPdfPreviewTarget?.groups.length ?? 0} group
              {(sectionPdfPreviewTarget?.groups.length ?? 0) === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {selectedSectionPreviewRows.length} record
              {selectedSectionPreviewRows.length === 1 ? "" : "s"}
            </Badge>
            {selectedSectionPreviewTermLabels.slice(0, 2).map((label) => (
              <Badge
                key={label}
                variant="outline"
                className={wrappingBadgeClassName}
              >
                {label}
              </Badge>
            ))}
            {selectedSectionPreviewTermLabels.length > 2 ? (
              <Badge variant="outline">
                +{selectedSectionPreviewTermLabels.length - 2} more term
                {selectedSectionPreviewTermLabels.length - 2 === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 max-w-full min-w-0 overflow-hidden rounded-md border">
            {sectionPdfPreviewBusy ? (
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating PDF preview...
                </div>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-[52vh] w-full" />
              </div>
            ) : sectionPdfUrl ? (
              <iframe
                title="Section PDF Preview"
                src={sectionPdfUrl}
                className="h-[60vh] w-full"
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                PDF preview is not ready yet.
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setSectionPdfPreviewTarget(null)}
            >
              Close
            </Button>

            <Button
              onClick={() => void onDownloadSectionPdf()}
              disabled={sectionPdfBusy || sectionPdfPreviewBusy || !sectionPdfPreviewTarget}
            >
              {sectionPdfBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {sectionPdfBusy ? "Downloading..." : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={selectedSectionDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!selectedSectionDeleteSubmitting) {
            setSelectedSectionDeleteDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Sections</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedSectionRecords.length} section
              record{selectedSectionRecords.length === 1 ? "" : "s"} across
              {" "}{selectedVisibleGroups.length} selected group
              {selectedVisibleGroups.length === 1 ? "" : "s"}
              {selectedSectionDeletePreview
                ? `, including ${selectedSectionDeletePreview}${selectedVisibleGroups.length > 3 ? ", and more" : ""}.`
                : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedSectionDeleteSubmitting ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
              Deleting selected sections...
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={selectedSectionDeleteSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedSections();
              }}
              disabled={selectedSectionDeleteSubmitting}
              className="bg-destructive text-white! hover:bg-destructive/90"
            >
              {selectedSectionDeleteSubmitting ? (
                <span className="inline-flex items-center gap-2 text-white">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete Selected"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogTitle>Delete Duplicated Sections</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSectionAction
                ? `Review each duplicate section group below. Choose the section record to keep, then continue. The other duplicate record${pendingSectionAction.duplicateCount === 1 ? " will" : "s will"} be deleted and their class references will be moved automatically.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingSectionAction?.kind === "mergeSections" ? (
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
              className="bg-destructive text-white! hover:bg-destructive/90"
            >
              {pendingSectionActionBusy ? (
                <span className="inline-flex items-center gap-2 text-white">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
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
                            onClick={() =>
                              openLinkDialog({
                                title: `Link ${buildSectionDisplayLabel(vm, section)}`,
                                description:
                                  "Link this section record's reusable group to subjects and one or more academic terms.",
                                groupKeys: [selectedSectionDetail.key],
                                initialSubjectIds: selectedSectionDetail.uniqueSubjectIds,
                              })
                            }
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Link
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={compactInlineButtonClassName}
                            onClick={() => {
                              vm.resetSectionDirtyFields();
                              vm.setSectionEditingBatch([]);
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
                openIndividualSectionPreview(selectedSectionDetail);
              }}
              disabled={
                !selectedSectionDetail || sectionPdfBusy || sectionPdfPreviewBusy
              }
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview PDF
            </Button>
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
            <DialogTitle>Academic Term Coverage</DialogTitle>
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
                  Missing Academic Term Links
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {missingAcademicTermCount}
                </div>
              </div>
            </div>

            {missingAcademicTermGroups.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                All visible section groups are already reusable across every
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
                            Current section coverage: {result.currentCoverageLabel}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground wrap-break-word">
                        Stored section term labels: {result.legacyCoverageLabels.length > 0 ? result.legacyCoverageLabels.join(", ") : "All Academic Terms"}
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
                void linkVisibleSectionGroupsAcrossAllTerms(
                  missingAcademicTermGroups,
                )
              }
              disabled={missingAcademicTermGroups.length === 0}
            >
              Link Visible Sections to Academic Terms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectViewerOpen} onOpenChange={setSubjectViewerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{subjectViewerTitle}</DialogTitle>
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

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="flex max-h-[92svh] flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{linkDialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            <div className="grid gap-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 px-3 py-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Target Section Groups
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {linkTargetGroups.length}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Target Section Records
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {linkTargetSections.length}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Selected Subjects
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {linkSelectedSubjectIds.length}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="border-b px-3 py-3">
                  <div className="text-sm font-medium">Academic Terms</div>
                </div>

                <div className="flex flex-col gap-3 border-b bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Selected academic terms:{" "}
                    <span className="font-medium text-foreground">
                      {linkSelectedAcademicTerms.length}
                    </span>
                  </div>

                  <label className="flex shrink-0 items-center gap-3 self-start sm:self-center">
                    <Checkbox
                      checked={
                        allLinkTermsSelected
                          ? true
                          : someLinkTermsSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        toggleAllLinkTerms(Boolean(value))
                      }
                      aria-label="Select all academic terms"
                    />
                    <span className="text-sm">Select all</span>
                  </label>
                </div>

                <div className="max-h-72 overflow-y-auto p-3">
                  <div className="space-y-2">
                    {academicTerms.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No academic terms found.
                      </div>
                    ) : (
                      academicTerms.map((term) => {
                        const checked = linkTargetTermIds.includes(term.id);

                        return (
                          <label
                            key={term.id}
                            htmlFor={`section-link-term-${term.id}`}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition hover:bg-muted/40"
                          >
                            <Checkbox
                              id={`section-link-term-${term.id}`}
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleLinkTargetTerm(term.id, Boolean(value))
                              }
                              aria-label={`Select ${term.label}`}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="wrap-break-word font-medium">{term.label}</div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="border-b px-3 py-3">
                  <div className="text-sm font-medium">Candidate Subjects</div>
                </div>

                <div className="flex flex-col gap-3 border-b bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Matching subjects:{" "}
                    <span className="font-medium text-foreground">
                      {linkCandidateSubjects.length}
                    </span>
                  </div>

                  <label className="flex shrink-0 items-center gap-3 self-start sm:self-center">
                    <Checkbox
                      checked={
                        allLinkCandidatesSelected
                          ? true
                          : someLinkCandidatesSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        toggleAllLinkCandidates(Boolean(value))
                      }
                      aria-label="Select all matching subjects"
                    />
                    <span className="text-sm">Select all</span>
                  </label>
                </div>

                <div className="max-h-80 overflow-y-auto p-3">
                  <div className="space-y-2">
                    {linkCandidateSubjects.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No matching subjects found for the selected section scope.
                      </div>
                    ) : (
                      linkCandidateSubjects.map((subject) => {
                        const subjectId = String(subject.$id);
                        const checked = linkSelectedSubjectIds.includes(subjectId);
                        const currentTermId = resolveSubjectTermId(subject);

                        return (
                          <label
                            key={subjectId}
                            htmlFor={`section-link-subject-${subjectId}`}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition hover:bg-muted/40"
                          >
                            <Checkbox
                              id={`section-link-subject-${subjectId}`}
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleLinkSubject(subjectId, Boolean(value))
                              }
                              aria-label={`Select ${subject.code}`}
                            />

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                  {subject.code}
                                </span>
                                <Badge variant="outline" className="max-w-full wrap-break-word whitespace-normal">
                                  {String(subject.semester ?? "").trim() || "—"}
                                </Badge>
                                <Badge
                                  variant={currentTermId ? "secondary" : "outline"}
                                  className="max-w-full wrap-break-word whitespace-normal"
                                >
                                  {currentTermId
                                    ? vm.termLabel(vm.terms, currentTermId)
                                    : "Not linked"}
                                </Badge>
                              </div>

                              <div className="wrap-break-word text-sm text-foreground">
                                {subject.title}
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  {vm.collegeLabel(
                                    vm.colleges,
                                    subject.departmentId ?? null,
                                  )}
                                </span>
                                <span>
                                  {vm.programLabel(
                                    vm.programs,
                                    subject.programId ?? null,
                                  )}
                                </span>
                                <span>
                                  Year:{" "}
                                  {resolveSubjectYearLevels(subject).join(", ") || "—"}
                                </span>
                              </div>

                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              disabled={linkUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveSectionSubjectAndTermLinks()}
              disabled={linkUpdating}
            >
              {linkUpdating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Linking...
                </span>
              ) : (
                "Save Section Links"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}