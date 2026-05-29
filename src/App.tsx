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
import { monthKey, monthRange } from "./utils/date";
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
  if (column.type === "SPARKLINE" && Array.isArray(value)) return value.join(" ");
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

function monthsBetweenDates(startMs: number, endMs: number) {
  const start = new Date(startMs);
  const end = new Date(endMs);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
}

function timelineMonthTicks(startMs: number, endMs: number, maxTicks = 7) {
  const startMonth = monthKey(new Date(startMs));
  const count = Math.max(1, monthsBetweenDates(startMs, endMs));
  const months = monthRange(startMonth, count);
  const step = Math.max(1, Math.ceil(months.length / maxTicks));
  return months.filter((_, index) => index % step === 0 || index === months.length - 1);
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

type AreaPoint = {
  x: number;
  y0: number;
  y1: number;
};

function stackedAreaPath(points: AreaPoint[]) {
  if (!points.length) return "";
  const upper = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y1.toFixed(1)}`)
    .join(" ");
  const lower = [...points]
    .reverse()
    .map((point) => `L ${point.x.toFixed(1)} ${point.y0.toFixed(1)}`)
    .join(" ");
  return `${upper} ${lower} Z`;
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function sparklineValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

function SparklineCell({ label, testId, values }: { label: string; testId: string; values: number[] }) {
  if (!values.length) return <span>-</span>;

  const width = 112;
  const height = 28;
  const padding = 4;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(1, maxValue - minValue);
  const xStep = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values
    .map((value, index) => {
      const x = padding + index * xStep;
      const y = height - padding - ((value - minValue) / span) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-testid={testId}>
      <polyline points={points} className="sparkline-line" />
      <circle cx={padding + (values.length - 1) * xStep} cy={height - padding - ((values[values.length - 1] - minValue) / span) * (height - padding * 2)} r="2.5" className="sparkline-dot" />
      <title>{`${label}: ${values.map((value) => Math.round(value)).join(", ")}`}</title>
    </svg>
  );
}

function isRightAlignedColumn(column: SheetColumn) {
  return column.type === "MONEY" || column.type === "PERCENT" || column.type === "CURRENCY";
}

function workbookColumnClassName(column: SheetColumn) {
  return [
    isRightAlignedColumn(column) ? "cell-align-right" : "",
    column.type === "SPARKLINE" ? "sparkline-cell" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

const STACK_COLORS = ["#1565C0", "#2E7D32", "#EF6C00", "#6A1B9A", "#00838F", "#C62828", "#455A64", "#9E9D24"];

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
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | undefined>();
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
  const visibleSeries = exposure.series.filter((series) => series.values.some((value) => value > 0));
  const baselines = exposure.months.map(() => 0);
  const layers = visibleSeries.map((series, seriesIndex) => {
    const points = series.values.map((value, index) => {
      const y0Value = baselines[index] ?? 0;
      const y1Value = y0Value + value;
      baselines[index] = y1Value;
      return {
        month: exposure.months[index],
        value,
        x: xFor(index),
        y0: yFor(y0Value),
        y1: yFor(y1Value),
        y: yFor(y1Value)
      };
    });
    return {
      key: series.key,
      color: STACK_COLORS[seriesIndex % STACK_COLORS.length],
      total: series.values.reduce((sum, value) => sum + value, 0),
      points
    };
  });
  const totalLinePath = linePath(
    exposure.totalByMonth.map((value, index) => ({
      x: xFor(index),
      y: yFor(value)
    }))
  );
  const selectedIndex = Math.max(0, exposure.months.indexOf(selectedMonth));
  const selectedValue = exposure.totalByMonth[selectedIndex] ?? 0;
  const selectedLayer =
    (selectedSeriesKey ? layers.find((layer) => layer.key === selectedSeriesKey) : undefined) ??
    layers.find((layer) => (layer.points[selectedIndex]?.value ?? 0) > 0) ??
    layers[0];
  const selectedLayerValue = selectedLayer?.points[selectedIndex]?.value ?? 0;
  const selectedBreakdown = layers
    .map((layer) => ({
      key: layer.key,
      value: layer.points[selectedIndex]?.value ?? 0
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <div className="chart-shell">
      <svg className="chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Stacked guarantee exposure area chart">
        <line
          x1={padding.left}
          x2={chartWidth - padding.right}
          y1={padding.top + innerHeight}
          y2={padding.top + innerHeight}
          className="axis-line"
        />
        {layers.map((layer) => {
          const isActive = selectedLayer?.key === layer.key;
          const selectLayer = () => setSelectedSeriesKey(layer.key);
          return (
            <path
              key={layer.key}
              d={stackedAreaPath(layer.points)}
              fill={layer.color}
              className={`stacked-area-layer ${isActive ? "active" : ""}`}
              data-testid={`guarantee-stack-layer-${layer.key}`}
              role="button"
              tabIndex={0}
              aria-label={`Show ${layer.key} stacked guarantee exposure`}
              onClick={selectLayer}
              onFocus={selectLayer}
              onMouseEnter={selectLayer}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") selectLayer();
              }}
            >
              <title>{`${layer.key} total ${formatCompactMoney(layer.total)}`}</title>
            </path>
          );
        })}
        <path d={totalLinePath} className="exposure-line" />
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
          Issued guarantee exposure by project
        </text>
      </svg>
      <div className="stacked-area-legend" aria-label="Guarantee stack layers">
        {layers.map((layer) => (
          <button
            type="button"
            key={layer.key}
            className={selectedLayer?.key === layer.key ? "active" : undefined}
            onClick={() => setSelectedSeriesKey(layer.key)}
            onFocus={() => setSelectedSeriesKey(layer.key)}
          >
            <span className="legend-swatch" style={{ backgroundColor: layer.color }} />
            {layer.key}
          </button>
        ))}
      </div>
      <div className="chart-detail" aria-live="polite">
        <span>Guarantee detail</span>
        <strong>{exposure.months[selectedIndex]}</strong>
        <span>{formatCompactMoney(selectedValue)} issued exposure</span>
        {selectedLayer && <span>{selectedLayer.key} {formatCompactMoney(selectedLayerValue)}</span>}
        {selectedBreakdown.length > 0 && (
          <span>{selectedBreakdown.map((entry) => `${entry.key} ${formatCompactMoney(entry.value)}`).join(" · ")}</span>
        )}
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
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
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

  function columnFilterKey(sheetId: string, columnId: string) {
    return `${sheetId}:${columnId}`;
  }

  function updateColumnFilter(sheetId: string, columnId: string, value: string) {
    const key = columnFilterKey(sheetId, columnId);
    setColumnFilters((current) => {
      const next = { ...current };
      if (value.trim()) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function workbookCellFilterText(row: Record<string, unknown>, column: SheetColumn) {
    const value = currentDraftValue(row, column.id);
    if (column.type === "SPARKLINE") return sparklineValues(value).map((entry) => Math.round(entry)).join(" ");
    return displayCellValue(column, value);
  }

  function rowMatchesWorkbookFilters(sheet: SheetViewModel, row: Record<string, unknown>) {
    return sheet.columns.every((column) => {
      const query = columnFilters[columnFilterKey(sheet.sheetId, column.id)]?.trim().toLowerCase();
      if (!query) return true;
      return workbookCellFilterText(row, column).toLowerCase().includes(query);
    });
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
      if (column.type === "SPARKLINE") {
        return (
          <SparklineCell
            label={`${column.title} ${entityCode}`}
            testId={`sparkline-${entityCode}-${column.id}`}
            values={sparklineValues(value)}
          />
        );
      }
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
    const visibleRows = rows.filter((row) => rowMatchesWorkbookFilters(sheet, row));

    return (
      <div className="workbook-grid" role="region" aria-label={`${sheet.name} grid`}>
        <table>
          <thead>
            <tr>
              {sheet.columns.map((column) => {
                const filterKey = columnFilterKey(sheet.sheetId, column.id);
                return (
                  <th key={column.id} className={workbookColumnClassName(column)}>
                    <div className="filter-header">
                      <span>{column.title}</span>
                      <input
                        aria-label={`Filter ${column.title}`}
                        value={columnFilters[filterKey] ?? ""}
                        onChange={(event) => updateColumnFilter(sheet.sheetId, column.id, event.target.value)}
                      />
                    </div>
                  </th>
                );
              })}
              {sheet.sheetId === "project-register" && <th aria-label="row actions" />}
            </tr>
          </thead>
          <tbody>
            {visibleRows.slice(0, 24).map((row) => {
              const rowId = String(row.id ?? row.code);
              const rowCode = String(row.code ?? rowId);
              const deleted = deletedProjectIds.has(rowId);
              return (
                <tr key={rowId} className={deleted ? "row-deleted" : undefined}>
                  {sheet.columns.map((column) => (
                    <td key={column.id} className={workbookColumnClassName(column)} data-testid={`cell-${rowCode}-${column.id}`}>
                      {renderWorkbookCell(row, column)}
                    </td>
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
    const guaranteesByProject = new Map(
      projects.map((project) => [project.id, repository.guarantees.filter((guarantee) => guarantee.projectId === project.id)])
    );
    const timelineDates = projects.flatMap((project) => {
      const guaranteeDates = (guaranteesByProject.get(project.id) ?? []).flatMap((guarantee) =>
        [guarantee.requiredDate, guarantee.issueDate, guarantee.expiryDate, guarantee.releaseDate].filter(
          (date): date is string => Boolean(date)
        )
      );
      return [project.startDate, project.plannedCOD, project.forecastCOD, ...guaranteeDates];
    });
    const selectedProject = projects.find((project) => project.id === selectedTimelineProjectId) ?? projects[0];
    const minDate = Math.min(...timelineDates.map((date) => safeDate(date)));
    const maxDate = Math.max(...timelineDates.map((date) => safeDate(date)));
    const span = Math.max(1, maxDate - minDate);
    const chartWidth = 1040;
    const labelWidth = 210;
    const chartRight = 24;
    const headerHeight = 46;
    const rowHeight = 36;
    const chartHeight = headerHeight + projects.length * rowHeight + 42;
    const plotWidth = chartWidth - labelWidth - chartRight;
    const xFor = (date: string) => labelWidth + ((safeDate(date) - minDate) / span) * plotWidth;
    const tickMonths = timelineMonthTicks(minDate, maxDate);

    return (
      <section className="panel timeline-panel">
        <div className="panel-header">
          <h2>EPC Control Timeline</h2>
          <span className="panel-meta">Project, COD and guarantee windows</span>
        </div>
        <div className="gantt-scroll">
          <svg
            className="gantt-chart"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Unified project gantt chart"
            data-testid="unified-gantt-chart"
          >
            <rect x={labelWidth} y="30" width={plotWidth} height={chartHeight - 66} rx="4" className="gantt-plot-bg" />
            {tickMonths.map((month) => {
              const x = xFor(`${month}-01`);
              return (
                <g key={month}>
                  <line x1={x} x2={x} y1="30" y2={chartHeight - 30} className="gantt-tick-line" />
                  <text x={x} y="20" textAnchor="middle" className="gantt-axis-label">
                    {monthLabel(month)}
                  </text>
                </g>
              );
            })}
            <text x="16" y="20" className="gantt-axis-label">
              Project
            </text>
            {projects.map((project, index) => {
              const projectGuarantees = guaranteesByProject.get(project.id) ?? [];
              const isSelected = selectedProject?.id === project.id;
              const selectProject = () => setSelectedTimelineProjectId(project.id);
              const rowY = headerHeight + index * rowHeight;
              const midY = rowY + rowHeight / 2;
              return (
                <g
                  className={`gantt-row ${isSelected ? "selected" : ""}`}
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`timeline-project-${project.code}`}
                  aria-label={`Show ${project.code} timeline detail`}
                  onClick={selectProject}
                  onFocus={selectProject}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectProject();
                    }
                  }}
                >
                  <rect x="0" y={rowY} width={chartWidth} height={rowHeight} className="gantt-hit-target" />
                  <rect x={labelWidth} y={rowY + 5} width={plotWidth} height={rowHeight - 10} rx="4" className="gantt-lane" />
                  <text x="16" y={midY - 1} className="gantt-project-code">
                    {project.code}
                  </text>
                  <text x="84" y={midY - 1} className="gantt-project-name">
                    {project.name}
                  </text>
                  <line x1={labelWidth} x2={chartWidth - chartRight} y1={midY} y2={midY} className="axis-line gantt-baseline" />
                  <rect
                    x={xFor(project.startDate)}
                    y={midY - 8}
                    width={Math.max(8, xFor(project.forecastCOD) - xFor(project.startDate))}
                    height="16"
                    rx="3"
                    className="timeline-bar"
                  />
                  <circle cx={xFor(project.plannedCOD)} cy={midY} r="4" className="timeline-dot planned" />
                  <circle cx={xFor(project.forecastCOD)} cy={midY} r="4" className="timeline-dot forecast" />
                  {projectGuarantees.slice(0, 2).map((guarantee, guaranteeIndex) => (
                    <rect
                      key={guarantee.id}
                      x={xFor(guarantee.issueDate ?? guarantee.requiredDate)}
                      y={midY + 11 + guaranteeIndex * 5}
                      width={Math.max(
                        6,
                        xFor(guarantee.releaseDate ?? guarantee.expiryDate ?? project.forecastCOD) -
                          xFor(guarantee.issueDate ?? guarantee.requiredDate)
                      )}
                      height="3"
                      rx="1.5"
                      className="guarantee-window"
                    />
                  ))}
                </g>
              );
            })}
            <g className="gantt-legend">
              <rect x={labelWidth} y={chartHeight - 23} width="28" height="6" rx="2" className="timeline-bar" />
              <text x={labelWidth + 36} y={chartHeight - 17} className="gantt-axis-label">
                Project span
              </text>
              <circle cx={labelWidth + 150} cy={chartHeight - 20} r="4" className="timeline-dot planned" />
              <text x={labelWidth + 160} y={chartHeight - 17} className="gantt-axis-label">
                Planned COD
              </text>
              <circle cx={labelWidth + 275} cy={chartHeight - 20} r="4" className="timeline-dot forecast" />
              <text x={labelWidth + 285} y={chartHeight - 17} className="gantt-axis-label">
                Forecast COD
              </text>
              <rect x={labelWidth + 420} y={chartHeight - 22} width="28" height="4" rx="1.5" className="guarantee-window" />
              <text x={labelWidth + 456} y={chartHeight - 17} className="gantt-axis-label">
                Guarantee window
              </text>
            </g>
          </svg>
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
