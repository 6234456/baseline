import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buildDashboardProjection, buildGuaranteeExposure, buildWorkbookProjection } from "./domain/projections";
import { createSeedRepository } from "./domain/seed";
import {
  commitStagingTransaction,
  createWorkbookEditSession,
  stageWorkbookEditSession
} from "./domain/workbookEdit";
import type {
  BusinessDiff,
  EpcRepository,
  Project,
  SheetColumn,
  SheetViewModel,
  StagingTransaction,
  WorkbookCellChange,
  WorkbookMode,
  WorkbookRowOperation
} from "./domain/types";
import { exportWorkbookXlsx, importWorkbookXlsx, downloadXlsx } from "./io/excel";
import { exportRepoSnapshot, importRepoSnapshot } from "./io/snapshot";
import { formatCompactMoney, formatMoney, formatPercent } from "./utils/format";
import "./styles.css";

type ViewId =
  | "dashboard"
  | "workbook"
  | "timeline"
  | "cashflow"
  | "guarantees"
  | "versions"
  | "import"
  | "settings";

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workbook", label: "Workbook", icon: Table2 },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
  { id: "cashflow", label: "Cashflow", icon: WalletCards },
  { id: "guarantees", label: "Guarantees", icon: ShieldCheck },
  { id: "versions", label: "Change Log", icon: History },
  { id: "import", label: "Import Center", icon: Upload },
  { id: "settings", label: "Settings", icon: Settings }
];

const PROJECT_STATUS_OPTIONS: Project["status"][] = [
  "BIDDING",
  "SIGNED",
  "ENGINEERING",
  "PROCUREMENT",
  "CONSTRUCTION",
  "COMMISSIONING",
  "COMPLETED",
  "SUSPENDED",
  "CANCELLED"
];

function metricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .replace("Kpis", "KPIs");
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function coerceInputValue(column: SheetColumn, rawValue: string) {
  if (column.type === "MONEY" || column.type === "PERCENT") {
    return Number(rawValue);
  }
  return rawValue;
}

function displayCellValue(column: SheetColumn, value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  if (column.type === "MONEY" && typeof value === "number") return formatMoney(value);
  if (column.type === "PERCENT" && typeof value === "number") return formatPercent(value);
  return String(value);
}

function statusClass(status: unknown) {
  const value = String(status).toLowerCase();
  if (value.includes("completed") || value.includes("paid") || value.includes("received") || value.includes("ready")) {
    return "status-good";
  }
  if (value.includes("delayed") || value.includes("overdue") || value.includes("invalid") || value.includes("suspended")) {
    return "status-risk";
  }
  if (value.includes("issued") || value.includes("construction") || value.includes("commissioning")) {
    return "status-active";
  }
  return "status-neutral";
}

function maxAbs(values: number[]) {
  return Math.max(1, ...values.map((value) => Math.abs(value)));
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${monthNumber}/${year.slice(2)}`;
}

function workflowStatusLabel(status: StagingTransaction["status"] | "OPEN") {
  if (status === "READY_TO_COMMIT") return "Ready to apply";
  if (status === "STAGED") return "Reviewed";
  if (status === "INVALID") return "Needs attention";
  if (status === "COMMITTED") return "Applied";
  if (status === "DISCARDED") return "Discarded";
  return "Draft";
}

function projectFromDraft(index: number): Project {
  const now = new Date().toISOString();
  return {
    id: `project-draft-${Date.now()}`,
    code: `EPC-${String(index).padStart(3, "0")}`,
    name: "New controlled workbook project",
    pm: "Local User",
    location: "Germany",
    content: "Solar + BESS",
    capacityKWh: 10000,
    customer: "Draft Customer",
    contractAmount: 1250000,
    currency: "EUR",
    startDate: "2026-06-01",
    plannedCOD: "2026-12-15",
    forecastCOD: "2027-01-15",
    status: "SIGNED",
    createdAt: now,
    updatedAt: now
  };
}

function safeDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function CashflowChart({ data }: { data: ReturnType<typeof buildDashboardProjection>["cashflow"] }) {
  const [selectedMonth, setSelectedMonth] = useState(data[0]?.month ?? "");
  const chartWidth = 820;
  const chartHeight = 260;
  const padding = { top: 18, right: 24, bottom: 42, left: 54 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxValue = maxAbs(data.flatMap((month) => [month.inflow, month.outflow, month.net]));
  const slot = innerWidth / data.length;
  const zeroY = padding.top + innerHeight * 0.72;
  const yFor = (value: number) => zeroY - (value / maxValue) * innerHeight * 0.64;
  const netPath = data
    .map((month, index) => {
      const x = padding.left + slot * index + slot / 2;
      const y = yFor(month.net);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const selected = data.find((month) => month.month === selectedMonth) ?? data[0];

  return (
    <div className="chart-shell">
      <svg className="chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Monthly cashflow chart">
        <line x1={padding.left} x2={chartWidth - padding.right} y1={zeroY} y2={zeroY} className="axis-line" />
        {data.map((month, index) => {
          const x = padding.left + slot * index + slot * 0.2;
          const barWidth = slot * 0.24;
          const inflowY = yFor(month.inflow);
          const outflowY = yFor(-month.outflow);
          const isSelected = selected?.month === month.month;
          const selectMonth = () => setSelectedMonth(month.month);
          return (
            <g
              key={month.month}
              className="chart-hit"
              role="button"
              tabIndex={0}
              aria-label={`Show ${month.month} cashflow detail`}
              data-testid={`cashflow-point-${month.month}`}
              onClick={selectMonth}
              onFocus={selectMonth}
              onMouseEnter={selectMonth}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") selectMonth();
              }}
            >
              <rect
                x={padding.left + slot * index}
                y={padding.top}
                width={slot}
                height={innerHeight}
                className="chart-hit-target"
              />
              <rect
                x={x}
                y={inflowY}
                width={barWidth}
                height={Math.max(2, zeroY - inflowY)}
                rx="2"
                className={`bar-inflow ${isSelected ? "active" : ""}`}
              >
                <title>{`${month.month} inflow ${formatCompactMoney(month.inflow)}`}</title>
              </rect>
              <rect
                x={x + barWidth + 3}
                y={zeroY}
                width={barWidth}
                height={Math.max(2, outflowY - zeroY)}
                rx="2"
                className={`bar-outflow ${isSelected ? "active" : ""}`}
              >
                <title>{`${month.month} outflow ${formatCompactMoney(month.outflow)}`}</title>
              </rect>
              <text x={padding.left + slot * index + slot / 2} y={chartHeight - 14} textAnchor="middle" className="chart-label">
                {monthLabel(month.month)}
              </text>
            </g>
          );
        })}
        <path d={netPath} className="net-line" />
        {data.map((month, index) => (
          <circle
            key={`${month.month}-net`}
            cx={padding.left + slot * index + slot / 2}
            cy={yFor(month.net)}
            r={selected?.month === month.month ? "5" : "3.5"}
            className={`net-dot ${selected?.month === month.month ? "active" : ""}`}
          >
            <title>{`${month.month} net ${formatCompactMoney(month.net)}`}</title>
          </circle>
        ))}
        <text x={padding.left} y="18" className="chart-caption">
          Forecast cashflow by month
        </text>
      </svg>
      {selected && (
        <div className="chart-detail" aria-live="polite">
          <span>Cashflow detail</span>
          <strong>{selected.month}</strong>
          <span>In {formatCompactMoney(selected.inflow)}</span>
          <span>Out {formatCompactMoney(selected.outflow)}</span>
          <span className={selected.net >= 0 ? "positive" : "negative"}>Net {formatCompactMoney(selected.net)}</span>
        </div>
      )}
    </div>
  );
}

function GuaranteeAreaChart({ repository }: { repository: EpcRepository }) {
  const [selectedMonth, setSelectedMonth] = useState("2026-06");
  const exposure = buildGuaranteeExposure(repository, {
    horizonMonths: 12,
    stackMode: "PROJECT",
    valueMode: "ISSUED_EXPOSURE"
  });
  const chartWidth = 820;
  const chartHeight = 250;
  const padding = { top: 22, right: 24, bottom: 40, left: 54 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...exposure.totalByMonth);
  const slot = innerWidth / Math.max(1, exposure.months.length - 1);
  const xFor = (index: number) => padding.left + slot * index;
  const yFor = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight;
  const linePath = exposure.totalByMonth
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xFor(exposure.totalByMonth.length - 1).toFixed(1)} ${
    padding.top + innerHeight
  } L ${padding.left} ${padding.top + innerHeight} Z`;
  const selectedIndex = Math.max(0, exposure.months.indexOf(selectedMonth));
  const selectedValue = exposure.totalByMonth[selectedIndex] ?? 0;

  return (
    <div className="chart-shell">
      <svg className="chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Guarantee exposure area chart">
        <defs>
          <linearGradient id="guaranteeGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1565C0" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#90CAF9" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <line
          x1={padding.left}
          x2={chartWidth - padding.right}
          y1={padding.top + innerHeight}
          y2={padding.top + innerHeight}
          className="axis-line"
        />
        <path d={areaPath} fill="url(#guaranteeGradient)" />
        <path d={linePath} className="exposure-line" />
        {exposure.totalByMonth.map((value, index) => {
          const month = exposure.months[index];
          const isSelected = index === selectedIndex;
          const selectMonth = () => setSelectedMonth(month);
          return (
            <g
              key={month}
              className="chart-hit"
              role="button"
              tabIndex={0}
              aria-label={`Show ${month} guarantee exposure detail`}
              data-testid={`guarantee-point-${month}`}
              onClick={selectMonth}
              onFocus={selectMonth}
              onMouseEnter={selectMonth}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") selectMonth();
              }}
            >
              <rect
                x={xFor(index) - slot / 2}
                y={padding.top}
                width={slot}
                height={innerHeight}
                className="chart-hit-target"
              />
              <circle cx={xFor(index)} cy={yFor(value)} r={isSelected ? "5" : "3.2"} className={`exposure-dot ${isSelected ? "active" : ""}`}>
                <title>{`${month} ${formatCompactMoney(value)}`}</title>
              </circle>
              <text x={xFor(index)} y={chartHeight - 14} textAnchor="middle" className="chart-label">
                {monthLabel(month)}
              </text>
            </g>
          );
        })}
        <text x={padding.left} y="18" className="chart-caption">
          Issued guarantee exposure
        </text>
      </svg>
      <div className="chart-detail" aria-live="polite">
        <span>Guarantee detail</span>
        <strong>{exposure.months[selectedIndex]}</strong>
        <span>{formatCompactMoney(selectedValue)} issued exposure</span>
        <span>{repository.guarantees.filter((guarantee) => guarantee.status === "ISSUED").length} issued guarantees</span>
      </div>
    </div>
  );
}

function DiffList({ diffs }: { diffs: BusinessDiff[] }) {
  if (!diffs.length) {
    return <div className="empty-state">No reviewed business changes.</div>;
  }

  return (
    <div className="diff-list">
      {diffs.map((diff) => (
        <div className="diff-row" key={diff.id}>
          <span className={`status-pill ${statusClass(diff.operation)}`}>{diff.operation}</span>
          <span>{diff.description}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [repository, setRepository] = useState<EpcRepository>(() => createSeedRepository());
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [workbookMode, setWorkbookMode] = useState<WorkbookMode>("VIEW");
  const [activeSheetId, setActiveSheetId] = useState("project-register");
  const [pendingChanges, setPendingChanges] = useState<WorkbookCellChange[]>([]);
  const [rowOperations, setRowOperations] = useState<WorkbookRowOperation[]>([]);
  const [staging, setStaging] = useState<StagingTransaction | null>(null);
  const [changeNote, setChangeNote] = useState("Update portfolio from workbook");
  const [notice, setNotice] = useState("Seed portfolio loaded");
  const [selectedTimelineProjectId, setSelectedTimelineProjectId] = useState("project-001");
  const [selectedExposureCell, setSelectedExposureCell] = useState<{
    seriesKey: string;
    month: string;
    value: number;
  } | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const dashboard = useMemo(() => buildDashboardProjection(repository), [repository]);
  const workbook = useMemo(() => buildWorkbookProjection(repository, workbookMode), [repository, workbookMode]);
  const currentScenario =
    repository.scenarios.find((scenario) => scenario.code === repository.settings.defaultScenarioCode) ?? repository.scenarios[0];
  const activeSheet = workbook.sheets.find((sheet) => sheet.sheetId === activeSheetId) ?? workbook.sheets[0];
  const deletedProjectIds = useMemo(
    () =>
      new Set(
        rowOperations
          .filter((operation) => operation.operation === "DELETE" && operation.entityType === "PROJECT")
          .map((operation) => operation.entityId)
          .filter((id): id is string => Boolean(id))
      ),
    [rowOperations]
  );
  const pendingChangeCount = pendingChanges.length + rowOperations.length;

  function clearWorkbookDraft() {
    setPendingChanges([]);
    setRowOperations([]);
    setStaging(null);
  }

  function switchWorkbookMode(nextMode: WorkbookMode) {
    setWorkbookMode(nextMode);
    clearWorkbookDraft();
    setNotice(nextMode === "EDIT" ? "Workbook edit mode opened" : "Workbook returned to view mode");
  }

  function updateActiveView(nextView: ViewId) {
    setActiveView(nextView);
  }

  function currentDraftValue(row: Record<string, unknown>, columnId: string) {
    const entityId = String(row.id ?? "");
    const change = pendingChanges.find((entry) => entry.entityId === entityId && entry.field === columnId);
    return change ? change.newValue : row[columnId];
  }

  function recordProjectChange(row: Record<string, unknown>, column: SheetColumn, rawValue: string) {
    const entityId = String(row.id ?? "");
    const entityCode = String(row.code ?? entityId);
    const oldValue = row[column.id];
    const newValue = coerceInputValue(column, rawValue);
    setPendingChanges((current) => {
      const next = current.filter((entry) => !(entry.entityId === entityId && entry.field === column.id));
      if (Object.is(oldValue, newValue)) return next;
      return [
        ...next,
        {
          id: `change-${entityId}-${column.id}`,
          entityType: "PROJECT",
          entityId,
          entityCode,
          field: column.id,
          oldValue,
          newValue
        }
      ];
    });
    setStaging(null);
  }

  function stageWorkbookChanges() {
    const session = createWorkbookEditSession(repository, activeSheetId);
    session.changes = pendingChanges;
    session.rowOperations = rowOperations;
    const staged = stageWorkbookEditSession(repository, session);
    setStaging(staged);
    setNotice(staged.status === "READY_TO_COMMIT" ? "Workbook changes reviewed" : "Validation errors found");
  }

  function commitWorkbookChanges() {
    if (!staging) return;
    const result = commitStagingTransaction(repository, staging, {
      author: repository.settings.currentUser.name,
      message: changeNote
    });
    setRepository(result.repository);
    clearWorkbookDraft();
    setChangeNote("Update portfolio from workbook");
    setNotice("Changes saved");
  }

  function addProjectRow() {
    const nextProject = projectFromDraft(repository.projects.length + rowOperations.length + 1);
    setRowOperations((current) => [
      ...current,
      {
        id: `row-create-${nextProject.id}`,
        operation: "CREATE",
        entityType: "PROJECT",
        entityId: nextProject.id,
        entityCode: nextProject.code,
        draftRow: { ...nextProject } as Record<string, unknown>
      }
    ]);
    setStaging(null);
    setNotice("New project row added to workbook draft");
  }

  function deleteProjectRow(row: Record<string, unknown>) {
    const entityId = String(row.id ?? "");
    const entityCode = String(row.code ?? entityId);
    if (entityId.startsWith("project-draft")) {
      setRowOperations((current) => current.filter((operation) => operation.entityId !== entityId));
    } else {
      setRowOperations((current) => {
        if (current.some((operation) => operation.operation === "DELETE" && operation.entityId === entityId)) return current;
        return [
          ...current,
          {
            id: `row-delete-${entityId}`,
            operation: "DELETE",
            entityType: "PROJECT",
            entityId,
            entityCode
          }
        ];
      });
      setPendingChanges((current) => current.filter((entry) => entry.entityId !== entityId));
    }
    setStaging(null);
  }

  function exportJson() {
    downloadTextFile(
      exportRepoSnapshot(repository, repository.settings.currentUser.name),
      "epc-repository-snapshot.json",
      "application/json"
    );
    setNotice("JSON snapshot exported");
  }

  async function exportExcel() {
    const buffer = await exportWorkbookXlsx(repository);
    downloadXlsx(buffer, "epc-workbook.xlsx");
    setNotice("Excel workbook exported");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>, mode: "json" | "excel") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const nextRepository =
        mode === "json" ? importRepoSnapshot(await file.text()) : await importWorkbookXlsx(await file.arrayBuffer());
      setRepository(nextRepository);
      clearWorkbookDraft();
      setNotice(`${file.name} imported`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed");
    } finally {
      event.target.value = "";
    }
  }

  function renderWorkbookCell(row: Record<string, unknown>, column: SheetColumn) {
    const entityCode = String(row.code ?? row.id ?? "row");
    const value = currentDraftValue(row, column.id);
    const canEdit =
      workbookMode === "EDIT" &&
      activeSheet.sheetId === "project-register" &&
      column.editable &&
      !deletedProjectIds.has(String(row.id ?? ""));

    if (!canEdit) {
      if (column.type === "STATUS") {
        return <span className={`status-pill ${statusClass(value)}`}>{displayCellValue(column, value)}</span>;
      }
      if (column.type === "COMMIT_HASH") {
        return <code>{displayCellValue(column, value)}</code>;
      }
      return displayCellValue(column, value);
    }

    const label = `${column.title} ${entityCode}`;
    if (column.id === "status") {
      return (
        <select
          aria-label={label}
          className="cell-input"
          value={String(value ?? "")}
          onChange={(event) => recordProjectChange(row, column, event.target.value)}
        >
          {PROJECT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        aria-label={label}
        className="cell-input"
        type={column.type === "MONEY" || column.type === "PERCENT" ? "number" : column.type === "DATE" ? "date" : "text"}
        value={String(value ?? "")}
        onChange={(event) => recordProjectChange(row, column, event.target.value)}
      />
    );
  }

  function renderWorkbookTable(sheet: SheetViewModel) {
    const createRows = rowOperations
      .filter((operation) => operation.operation === "CREATE" && operation.entityType === "PROJECT" && operation.draftRow)
      .map((operation) => operation.draftRow as Record<string, unknown>);
    const rows = sheet.sheetId === "project-register" ? [...createRows, ...sheet.rows] : sheet.rows;

    return (
      <div className="workbook-grid" role="region" aria-label={`${sheet.name} grid`}>
        <table>
          <thead>
            <tr>
              {sheet.columns.map((column) => (
                <th key={column.id}>{column.title}</th>
              ))}
              {sheet.sheetId === "project-register" && <th aria-label="row actions" />}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 24).map((row) => {
              const rowId = String(row.id ?? row.code);
              const deleted = deletedProjectIds.has(rowId);
              return (
                <tr key={rowId} className={deleted ? "row-deleted" : undefined}>
                  {sheet.columns.map((column) => (
                    <td key={column.id}>{renderWorkbookCell(row, column)}</td>
                  ))}
                  {sheet.sheetId === "project-register" && (
                    <td className="action-cell">
                      {workbookMode === "EDIT" && (
                        <button
                          className="icon-button danger"
                          type="button"
                          aria-label={`Delete ${String(row.code ?? rowId)}`}
                          onClick={() => deleteProjectRow(row)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderDashboard() {
    const metricEntries = [
      ["totalContractValue", dashboard.kpis.totalContractValue, "Portfolio TCV"],
      ["cashInNext90Days", dashboard.kpis.cashInNext90Days, "Cash in 90d"],
      ["issuedGuaranteeExposure", dashboard.kpis.issuedGuaranteeExposure, "Guarantee exposure"],
      ["overdueReceivables", dashboard.kpis.overdueReceivables, "Overdue receivables"],
      ["activeProjects", dashboard.kpis.activeProjects, "Active projects"]
    ] as const;

    return (
      <>
        <section className="summary-band">
          {metricEntries.map(([key, value, label]) => (
            <div className="metric-card" key={key}>
              <span>{label}</span>
              <strong>{key === "activeProjects" ? value : formatCompactMoney(value)}</strong>
            </div>
          ))}
        </section>
        <section className="panel-grid two">
          <div className="panel">
            <div className="panel-header">
              <h2>Cashflow</h2>
              <span className="panel-meta">Base scenario, EUR</span>
            </div>
            <CashflowChart data={dashboard.cashflow} />
          </div>
          <div className="panel">
            <div className="panel-header">
              <h2>Guarantees</h2>
              <span className="panel-meta">Issued exposure</span>
            </div>
            <GuaranteeAreaChart repository={repository} />
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Portfolio Control Board</h2>
            <span className="panel-meta">{repository.projects.length} projects</span>
          </div>
          <div className="dense-list">
            {repository.projects.slice(0, 8).map((project) => {
              const progress = repository.progressSnapshots.find((snapshot) => snapshot.projectId === project.id)?.overallPct ?? 0;
              return (
                <div className="project-row" key={project.id}>
                  <code>{project.code}</code>
                  <span>{project.name}</span>
                  <span>{project.pm}</span>
                  <span className={`status-pill ${statusClass(project.status)}`}>{project.status}</span>
                  <span>{formatMoney(project.contractAmount)}</span>
                  <div className="progress-track" aria-label={`${project.code} progress`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  function renderWorkbook() {
    return (
      <>
        <section className="workbook-toolbar">
          <div className="segmented" role="group" aria-label="Workbook mode">
            <button
              type="button"
              className={workbookMode === "VIEW" ? "active" : undefined}
              onClick={() => switchWorkbookMode("VIEW")}
            >
              <Eye size={16} /> View Mode
            </button>
            <button
              type="button"
              className={workbookMode === "EDIT" ? "active" : undefined}
              onClick={() => switchWorkbookMode("EDIT")}
            >
              <Pencil size={16} /> Edit Mode
            </button>
          </div>
          <div className="toolbar-actions">
            {workbookMode === "EDIT" && activeSheet.sheetId === "project-register" && (
              <button type="button" className="secondary-button" onClick={addProjectRow}>
                <Plus size={16} /> Add row
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              disabled={!pendingChangeCount}
              onClick={clearWorkbookDraft}
            >
              <RefreshCw size={16} /> Clear draft
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!pendingChangeCount}
              onClick={stageWorkbookChanges}
            >
              <Save size={16} /> Review changes
            </button>
          </div>
        </section>
        <section className="sheet-tabs" aria-label="Workbook sheets">
          {workbook.sheets.map((sheet) => (
            <button
              type="button"
              key={sheet.sheetId}
              className={sheet.sheetId === activeSheet.sheetId ? "active" : undefined}
              onClick={() => setActiveSheetId(sheet.sheetId)}
            >
              {sheet.name}
            </button>
          ))}
        </section>
        <section className="panel workbook-panel">
          <div className="panel-header">
            <h2>{activeSheet.name}</h2>
            <span className={`status-pill ${workbookMode === "EDIT" ? "status-active" : "status-neutral"}`}>
              {workbookMode}
            </span>
          </div>
          {renderWorkbookTable(activeSheet)}
        </section>
        <section className="panel-grid two">
          <div className="panel">
            <div className="panel-header">
              <h2>Validation</h2>
              <span className={`status-pill ${statusClass(staging?.status ?? "open")}`}>
                {workflowStatusLabel(staging?.status ?? "OPEN")}
              </span>
            </div>
            {staging?.validationIssues.length ? (
              <div className="issue-list">
                {staging.validationIssues.map((issue) => (
                  <div className="issue-row" key={issue.id}>
                    <AlertTriangle size={16} />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No blocking validation issues.</div>
            )}
          </div>
          <div className="panel">
            <div className="panel-header">
              <h2>Business Changes</h2>
              <span className="panel-meta">{staging?.diff.length ?? 0} entries</span>
            </div>
            <DiffList diffs={staging?.diff ?? []} />
          </div>
        </section>
        <section className="change-band">
          <label htmlFor="change-note">Change note</label>
          <input
            id="change-note"
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
          />
          <button
            type="button"
            className="primary-button"
            disabled={!staging || staging.status !== "READY_TO_COMMIT" || !changeNote.trim()}
            onClick={commitWorkbookChanges}
          >
            <CheckCircle2 size={16} /> Apply reviewed changes
          </button>
        </section>
      </>
    );
  }

  function renderTimeline() {
    const projects = repository.projects.slice(0, 12);
    const selectedProject = projects.find((project) => project.id === selectedTimelineProjectId) ?? projects[0];
    const minDate = Math.min(...projects.map((project) => safeDate(project.startDate)));
    const maxDate = Math.max(...projects.map((project) => safeDate(project.forecastCOD)));
    const span = Math.max(1, maxDate - minDate);
    const xFor = (date: string) => 20 + ((safeDate(date) - minDate) / span) * 620;

    return (
      <section className="panel timeline-panel">
        <div className="panel-header">
          <h2>EPC Control Timeline</h2>
          <span className="panel-meta">Project, COD and guarantee windows</span>
        </div>
        <div className="timeline-grid">
          {projects.map((project) => {
            const projectGuarantees = repository.guarantees.filter((guarantee) => guarantee.projectId === project.id);
            const isSelected = selectedProject?.id === project.id;
            const selectProject = () => setSelectedTimelineProjectId(project.id);
            return (
              <div
                className={`timeline-row interactive ${isSelected ? "selected" : ""}`}
                key={project.id}
                role="button"
                tabIndex={0}
                data-testid={`timeline-project-${project.code}`}
                aria-label={`Show ${project.code} timeline detail`}
                onClick={selectProject}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") selectProject();
                }}
              >
                <div className="timeline-label">
                  <code>{project.code}</code>
                  <span>{project.name}</span>
                </div>
                <svg viewBox="0 0 680 54" className="timeline-svg" role="img" aria-label={`${project.code} timeline`}>
                  <line x1="20" x2="650" y1="18" y2="18" className="axis-line" />
                  <rect
                    x={xFor(project.startDate)}
                    y="10"
                    width={Math.max(8, xFor(project.forecastCOD) - xFor(project.startDate))}
                    height="16"
                    rx="3"
                    className="timeline-bar"
                  />
                  <circle cx={xFor(project.plannedCOD)} cy="18" r="4" className="timeline-dot planned" />
                  <circle cx={xFor(project.forecastCOD)} cy="18" r="4" className="timeline-dot forecast" />
                  {projectGuarantees.slice(0, 2).map((guarantee, index) => (
                    <rect
                      key={guarantee.id}
                      x={xFor(guarantee.issueDate ?? guarantee.requiredDate)}
                      y={32 + index * 8}
                      width={Math.max(6, xFor(guarantee.releaseDate ?? guarantee.expiryDate ?? project.forecastCOD) - xFor(guarantee.issueDate ?? guarantee.requiredDate))}
                      height="5"
                      rx="2"
                      className="guarantee-window"
                    />
                  ))}
                </svg>
              </div>
            );
          })}
        </div>
        {selectedProject && (
          <div className="chart-detail timeline-detail" aria-live="polite">
            <span>Timeline detail</span>
            <strong>{selectedProject.code}</strong>
            <span>{selectedProject.startDate} to {selectedProject.forecastCOD}</span>
            <span>{selectedProject.status}</span>
          </div>
        )}
      </section>
    );
  }

  function renderCashflow() {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Cashflow Forecast</h2>
          <span className="panel-meta">Monthly projection</span>
        </div>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Inflow</th>
                <th>Outflow</th>
                <th>Net</th>
                <th>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.cashflow.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{formatMoney(month.inflow)}</td>
                  <td>{formatMoney(month.outflow)}</td>
                  <td className={month.net >= 0 ? "positive" : "negative"}>{formatMoney(month.net)}</td>
                  <td>{formatMoney(month.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderGuarantees() {
    const exposure = buildGuaranteeExposure(repository, {
      horizonMonths: 12,
      stackMode: "BANK",
      valueMode: "ISSUED_EXPOSURE"
    });
    const activeExposureCell =
      selectedExposureCell ?? {
        seriesKey: exposure.series[0]?.key ?? "Portfolio",
        month: exposure.months[0] ?? "2026-06",
        value: exposure.series[0]?.values[0] ?? 0
      };

    return (
      <>
        <section className="panel">
          <div className="panel-header">
            <h2>Guarantee Exposure</h2>
            <span className="panel-meta">Stacked by bank</span>
          </div>
          <div className="heatmap">
            {exposure.series.slice(0, 6).map((series) => (
              <div className="heatmap-row" key={series.key}>
                <span>{series.key}</span>
                {series.values.map((value, index) => (
                  <button
                    type="button"
                    key={`${series.key}-${exposure.months[index]}`}
                    title={`${series.key} ${exposure.months[index]} ${formatCompactMoney(value)}`}
                    aria-label={`Show ${series.key} ${exposure.months[index]} exposure detail`}
                    data-testid={`guarantee-heatmap-${series.key}-${exposure.months[index]}`}
                    className={
                      activeExposureCell.seriesKey === series.key && activeExposureCell.month === exposure.months[index]
                        ? "active"
                        : undefined
                    }
                    onClick={() =>
                      setSelectedExposureCell({
                        seriesKey: series.key,
                        month: exposure.months[index],
                        value
                      })
                    }
                    style={{ opacity: Math.max(0.08, value / Math.max(1, ...exposure.totalByMonth)) }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="chart-detail" aria-live="polite">
            <span>Exposure cell</span>
            <strong>{activeExposureCell.month}</strong>
            <span>{activeExposureCell.seriesKey}</span>
            <span>{formatCompactMoney(activeExposureCell.value)}</span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Guarantee Register</h2>
            <span className="panel-meta">{repository.guarantees.length} guarantees</span>
          </div>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Bank</th>
                  <th>Issued</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {repository.guarantees.slice(0, 14).map((guarantee) => (
                  <tr key={guarantee.id}>
                    <td><code>{guarantee.code}</code></td>
                    <td>{guarantee.type}</td>
                    <td>{guarantee.bank}</td>
                    <td>{formatMoney(guarantee.issuedAmount)}</td>
                    <td>{guarantee.expiryDate ?? "-"}</td>
                    <td><span className={`status-pill ${statusClass(guarantee.status)}`}>{guarantee.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderVersions() {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Change Log</h2>
          <span className="panel-meta">{repository.commits.length} saved update{repository.commits.length === 1 ? "" : "s"}</span>
        </div>
        <div className="change-list">
          {repository.commits.map((change) => (
            <div className="change-row" key={change.id}>
              <History size={16} />
              <div>
                <strong>{change.message}</strong>
                <span>{change.author} · {new Date(change.createdAt).toLocaleDateString("en-GB")}</span>
              </div>
              <span>
                {change.diffSummary.projectsChanged} projects · {formatCompactMoney(change.diffSummary.cashflowImpactNext90Days)} cash impact
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderImportCenter() {
    return (
      <section className="panel-grid two">
        <div className="panel">
          <div className="panel-header">
            <h2>Import</h2>
            <span className="panel-meta">JSON or Excel</span>
          </div>
          <div className="action-grid">
            <button type="button" className="secondary-button" onClick={() => jsonInputRef.current?.click()}>
              <FileJson size={16} /> Import JSON
            </button>
            <button type="button" className="secondary-button" onClick={() => excelInputRef.current?.click()}>
              <FileSpreadsheet size={16} /> Import Excel
            </button>
          </div>
          <input ref={jsonInputRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importFile(event, "json")} />
          <input ref={excelInputRef} hidden type="file" accept=".xlsx,.xls" onChange={(event) => void importFile(event, "excel")} />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Export</h2>
            <span className="panel-meta">Snapshot and workbook</span>
          </div>
          <div className="action-grid">
            <button type="button" className="primary-button" onClick={exportJson}>
              <Download size={16} /> Export JSON
            </button>
            <button type="button" className="primary-button" onClick={() => void exportExcel()}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderSettings() {
    const settingsRows = [
      ["Base currency", repository.settings.baseCurrency],
      ["Current user", repository.settings.currentUser.name],
      ["Scenario", repository.settings.defaultScenarioCode],
      ["Horizon", `${repository.settings.chartDefaults.horizonMonths} months`],
      ["Time grain", repository.settings.chartDefaults.timeGrain]
    ];

    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Settings</h2>
          <span className="panel-meta">Local MVP state</span>
        </div>
        <div className="settings-grid">
          {settingsRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderActiveView() {
    if (activeView === "workbook") return renderWorkbook();
    if (activeView === "timeline") return renderTimeline();
    if (activeView === "cashflow") return renderCashflow();
    if (activeView === "guarantees") return renderGuarantees();
    if (activeView === "versions") return renderVersions();
    if (activeView === "import") return renderImportCenter();
    if (activeView === "settings") return renderSettings();
    return renderDashboard();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Database size={24} />
          <div>
            <strong>EPC Control Console</strong>
            <span>MVP</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={item.id === activeView ? "active" : undefined}
                onClick={() => updateActiveView(item.id)}
                aria-label={`Open ${item.label}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{NAV_ITEMS.find((item) => item.id === activeView)?.label ?? "Dashboard"}</h1>
            <span>{notice}</span>
          </div>
          <div className="context-bar" aria-label="Workspace context">
            <span><BarChart3 size={14} /> {currentScenario?.name ?? "Base"} scenario</span>
            <span>{repository.settings.baseCurrency}</span>
            <span className={pendingChangeCount ? "dirty" : undefined}>{pendingChangeCount} draft</span>
          </div>
          <div className="top-actions">
            <button type="button" className="icon-text-button" onClick={() => jsonInputRef.current?.click()}>
              <Upload size={16} /> JSON
            </button>
            <button type="button" className="icon-text-button" onClick={() => excelInputRef.current?.click()}>
              <Upload size={16} /> Excel
            </button>
            <button type="button" className="icon-text-button" onClick={exportJson}>
              <FileJson size={16} /> JSON
            </button>
            <button type="button" className="icon-text-button" onClick={() => void exportExcel()}>
              <FileSpreadsheet size={16} /> Excel
            </button>
          </div>
        </header>
        <div className="content-area">{renderActiveView()}</div>
      </main>
    </div>
  );
}

export default App;
