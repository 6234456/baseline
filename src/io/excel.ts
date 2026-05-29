import type ExcelJS from "exceljs";
import type {
  Branch,
  CashflowItem,
  EpcRepository,
  Guarantee,
  Milestone,
  ProgressSnapshot,
  Project,
  ProjectPhase,
  Scenario,
  VersionCommit,
  VersionTag
} from "../domain/types";
import { buildDashboardProjection, guaranteeAnnualInterest } from "../domain/projections";
import { createSeedRepository } from "../domain/seed";

type ExcelWorkbook = ExcelJS.Workbook;
type ExcelBuffer = ExcelJS.Buffer;

async function createWorkbook(): Promise<ExcelWorkbook> {
  const module = await import("exceljs");
  return new module.default.Workbook();
}

function appendSheet<T extends object>(workbook: ExcelWorkbook, rows: T[], name: string) {
  const worksheet = workbook.addWorksheet(name);
  const normalizedRows = rows.length ? rows : [{ status: "No rows" }];
  const keys = [...new Set(normalizedRows.flatMap((row) => Object.keys(row)))];

  worksheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.max(14, Math.min(34, key.length + 4))
  }));
  normalizedRows.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  return worksheet;
}

function appendJsonSheet(workbook: ExcelWorkbook, rows: Array<{ key: string; json: string }>, name: string) {
  return appendSheet(workbook, rows, name);
}

function hideInternalSource<T extends { sourceCommitId?: unknown }>(rows: T[]) {
  return rows.map(({ sourceCommitId: _sourceCommitId, ...row }) => row);
}

function guaranteeExportRows(guarantees: Guarantee[]) {
  return guarantees.map((guarantee) => ({
    ...guarantee,
    annualInterest: guaranteeAnnualInterest(guarantee)
  }));
}

function toArrayBuffer(buffer: ExcelBuffer): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) return buffer.slice(0);
  const view = buffer as unknown as Uint8Array;
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

function normalizeCellValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text);
  }
  return value;
}

function readSheet<T>(workbook: ExcelWorkbook, name: string): T[] {
  const worksheet = workbook.getWorksheet(name);
  if (!worksheet) return [];

  const headerValues = worksheet.getRow(1).values as unknown[];
  const headers = headerValues.slice(1).map((value) => String(value));
  const rows: T[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as unknown[];
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const value = normalizeCellValue(values[index + 1]);
      if (value !== undefined && value !== null) {
        record[header] = value;
      }
    });
    if (record.status === "No rows") return;
    if (Object.keys(record).length > 0) rows.push(record as T);
  });

  return rows;
}

function readMetadata<T>(metadata: Array<{ key?: string; json?: string }>, key: string, fallback: T): T {
  const entry = metadata.find((row) => row.key === key);
  if (!entry?.json) return fallback;
  return JSON.parse(entry.json) as T;
}

async function loadWorkbook(buffer: ArrayBuffer) {
  const workbook = await createWorkbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export async function exportWorkbookXlsx(repository: EpcRepository) {
  const workbook = await createWorkbook();
  workbook.creator = "EPC Control Console";
  workbook.created = new Date();
  workbook.modified = new Date();
  const dashboard = buildDashboardProjection(repository);

  appendSheet(
    workbook,
    Object.entries(dashboard.kpis).map(([metric, value]) => ({ metric, value, currency: "EUR" })),
    "Portfolio Summary"
  );
  appendSheet(workbook, hideInternalSource(repository.projects), "Project Register");
  appendSheet(workbook, hideInternalSource(repository.projectPhases), "Project Phases");
  appendSheet(workbook, hideInternalSource(repository.milestones), "Milestone Plan");
  appendSheet(workbook, hideInternalSource(guaranteeExportRows(repository.guarantees)), "Guarantee Register");
  appendSheet(workbook, hideInternalSource(repository.cashflowItems), "Cashflow Forecast");
  appendSheet(workbook, hideInternalSource(repository.progressSnapshots), "Progress Snapshot");
  appendSheet(workbook, [], "Validation Errors");
  const metadataSheet = appendJsonSheet(
    workbook,
    [
      { key: "settings", json: JSON.stringify(repository.settings) },
      { key: "scenarios", json: JSON.stringify(repository.scenarios) },
      { key: "commits", json: JSON.stringify(repository.commits) },
      { key: "branches", json: JSON.stringify(repository.branches) },
      { key: "tags", json: JSON.stringify(repository.tags) }
    ],
    "Repo Metadata"
  );
  metadataSheet.state = "veryHidden";

  return toArrayBuffer(await workbook.xlsx.writeBuffer());
}

export async function parseWorkbookSheetNames(buffer: ArrayBuffer) {
  const workbook = await loadWorkbook(buffer);
  return workbook.worksheets.map((worksheet) => worksheet.name);
}

export async function importWorkbookXlsx(buffer: ArrayBuffer): Promise<EpcRepository> {
  const workbook = await loadWorkbook(buffer);
  const fallback = createSeedRepository();
  const metadata = readSheet<{ key?: string; json?: string }>(workbook, "Repo Metadata");

  return {
    projects: readSheet<Project>(workbook, "Project Register"),
    projectPhases: readSheet<ProjectPhase>(workbook, "Project Phases"),
    milestones: readSheet<Milestone>(workbook, "Milestone Plan"),
    progressSnapshots: readSheet<ProgressSnapshot>(workbook, "Progress Snapshot"),
    guarantees: readSheet<Guarantee>(workbook, "Guarantee Register"),
    cashflowItems: readSheet<CashflowItem>(workbook, "Cashflow Forecast"),
    scenarios: readMetadata<Scenario[]>(metadata, "scenarios", fallback.scenarios),
    commits: readMetadata<VersionCommit[]>(metadata, "commits", fallback.commits),
    branches: readMetadata<Branch[]>(metadata, "branches", fallback.branches),
    tags: readMetadata<VersionTag[]>(metadata, "tags", fallback.tags),
    settings: readMetadata<EpcRepository["settings"]>(metadata, "settings", fallback.settings)
  };
}

export function downloadXlsx(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
