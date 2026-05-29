import type {
  DashboardProjection,
  EpcRepository,
  Guarantee,
  GuaranteeExposureProjection,
  SheetViewModel,
  WorkbookViewModel
} from "./types";
import { monthBounds, monthKey, monthRange } from "../utils/date";

const DEFAULT_START_MONTH = "2026-06";

function activeGuaranteeAmount(guarantee: Guarantee, month: string, mode: GuaranteeExposureOptions["valueMode"]) {
  if (guarantee.status === "CANCELLED") return 0;
  const { start, end } = monthBounds(month);
  const activeStart = guarantee.issueDate ?? guarantee.requiredDate;
  const activeEnd = guarantee.releaseDate ?? guarantee.expiryDate;
  const startDate = new Date(`${activeStart}T00:00:00.000Z`);
  const endDate = activeEnd ? new Date(`${activeEnd}T23:59:59.000Z`) : undefined;
  const active = startDate <= end && (!endDate || endDate >= start);
  if (!active) return 0;
  if (mode === "REQUIRED_EXPOSURE") return guarantee.requiredAmount;
  if (mode === "FEE_FORECAST") return Math.round((guarantee.issuedAmount * guarantee.feeRate) / 12);
  return guarantee.issuedAmount;
}

export interface GuaranteeExposureOptions {
  horizonMonths: number;
  stackMode: "PROJECT" | "PM" | "LOCATION" | "BANK" | "GUARANTEE_TYPE";
  valueMode: "ISSUED_EXPOSURE" | "REQUIRED_EXPOSURE" | "FEE_FORECAST";
}

export function buildGuaranteeExposure(
  repository: EpcRepository,
  options: GuaranteeExposureOptions
): GuaranteeExposureProjection {
  const months = monthRange(DEFAULT_START_MONTH, options.horizonMonths);
  const projectById = new Map(repository.projects.map((project) => [project.id, project]));

  const keyFor = (guarantee: Guarantee) => {
    const project = projectById.get(guarantee.projectId);
    if (options.stackMode === "BANK") return guarantee.bank || "No bank";
    if (options.stackMode === "GUARANTEE_TYPE") return guarantee.type;
    if (options.stackMode === "PM") return project?.pm ?? "Unknown PM";
    if (options.stackMode === "LOCATION") return project?.location ?? "Unknown location";
    return project?.code ?? "Unknown project";
  };

  const totalsByKey = new Map<string, number>();
  const valuesByKey = new Map<string, number[]>();

  for (const guarantee of repository.guarantees) {
    const key = keyFor(guarantee);
    const values = months.map((month) => activeGuaranteeAmount(guarantee, month, options.valueMode));
    totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + values.reduce((sum, value) => sum + value, 0));
    valuesByKey.set(
      key,
      values.map((value, index) => value + (valuesByKey.get(key)?.[index] ?? 0))
    );
  }

  const sortedKeys = [...totalsByKey.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const topKeys = sortedKeys.slice(0, 7);
  const otherKeys = sortedKeys.slice(7);
  const series = topKeys.map((key) => ({ key, values: valuesByKey.get(key) ?? months.map(() => 0) }));
  const otherValues = months.map((_, index) =>
    otherKeys.reduce((sum, key) => sum + (valuesByKey.get(key)?.[index] ?? 0), 0)
  );
  series.push({ key: "Others", values: otherValues });
  const totalByMonth = months.map((_, index) =>
    series.reduce((sum, entry) => sum + entry.values[index], 0)
  );

  return { months, series, totalByMonth, currency: "EUR" };
}

export function buildDashboardProjection(repository: EpcRepository): DashboardProjection {
  const months = monthRange(DEFAULT_START_MONTH, 12);
  let cumulative = 0;
  const cashflow = months.map((month) => {
    const items = repository.cashflowItems.filter((item) => monthKey(item.forecastDate) === month);
    const inflow = items
      .filter((item) => item.type === "INFLOW")
      .reduce((sum, item) => sum + item.amount * item.probability, 0);
    const outflow = items
      .filter((item) => item.type === "OUTFLOW")
      .reduce((sum, item) => sum + item.amount * item.probability, 0);
    const net = inflow - outflow;
    cumulative += net;
    return { month, inflow, outflow, net, cumulative, currency: "EUR" as const };
  });

  const exposure = buildGuaranteeExposure(repository, {
    horizonMonths: 12,
    stackMode: "PROJECT",
    valueMode: "ISSUED_EXPOSURE"
  });

  return {
    kpis: {
      totalContractValue: repository.projects.reduce((sum, project) => sum + project.contractAmount, 0),
      cashInNext90Days: cashflow.slice(0, 3).reduce((sum, month) => sum + month.inflow, 0),
      issuedGuaranteeExposure: exposure.totalByMonth[0] ?? 0,
      overdueReceivables: repository.cashflowItems
        .filter((item) => item.status === "OVERDUE")
        .reduce((sum, item) => sum + item.amount, 0),
      activeProjects: repository.projects.filter((project) => !["COMPLETED", "CANCELLED"].includes(project.status)).length
    },
    cashflow
  };
}

export function buildWorkbookProjection(repository: EpcRepository, mode = "VIEW" as "VIEW" | "EDIT"): WorkbookViewModel {
  const readOnly = mode === "VIEW";
  const commitHash = repository.branches[0]?.headCommitHash ?? repository.commits[0]?.hash ?? "none";
  const generatedFrom = {
    branch: repository.branches[0]?.name ?? "base",
    commitHash,
    scenarioId: repository.settings.defaultScenarioCode,
    generatedAt: new Date().toISOString()
  };

  const sheets: SheetViewModel[] = [
    {
      sheetId: "portfolio-summary",
      name: "Portfolio Summary",
      readOnly: true,
      mode,
      editable: false,
      columns: [
        { id: "metric", title: "Metric", type: "TEXT" },
        { id: "value", title: "Value", type: "TEXT" }
      ],
      rows: Object.entries(buildDashboardProjection(repository).kpis).map(([metric, value]) => ({ metric, value }))
    },
    {
      sheetId: "project-register",
      name: "Project Register",
      readOnly,
      mode,
      editable: true,
      allowedRowOperations: ["CREATE", "UPDATE", "DELETE"],
      columns: [
        { id: "code", title: "Project Code", type: "TEXT" },
        { id: "name", title: "Project Name", type: "TEXT", editable: true },
        { id: "pm", title: "PM", type: "TEXT", editable: true },
        { id: "location", title: "Location", type: "TEXT", editable: true },
        { id: "contractAmount", title: "Contract Amount", type: "MONEY", editable: true },
        { id: "status", title: "Status", type: "STATUS", editable: true },
        { id: "sourceCommitId", title: "Source Commit", type: "COMMIT_HASH" }
      ],
      rows: repository.projects.map((project) => ({ ...project }))
    },
    {
      sheetId: "project-phases",
      name: "Project Phases",
      readOnly,
      mode,
      editable: true,
      allowedRowOperations: ["CREATE", "UPDATE", "DELETE"],
      columns: [
        { id: "projectId", title: "Project", type: "TEXT" },
        { id: "phaseType", title: "Phase", type: "TEXT", editable: true },
        { id: "progressPct", title: "Progress", type: "PERCENT", editable: true },
        { id: "status", title: "Status", type: "STATUS", editable: true }
      ],
      rows: repository.projectPhases.map((phase) => ({ ...phase }))
    },
    {
      sheetId: "milestone-plan",
      name: "Milestone Plan",
      readOnly,
      mode,
      editable: true,
      allowedRowOperations: ["CREATE", "UPDATE", "DELETE"],
      columns: [
        { id: "code", title: "Milestone Code", type: "TEXT" },
        { id: "name", title: "Milestone Name", type: "TEXT", editable: true },
        { id: "forecastDate", title: "Forecast Date", type: "DATE", editable: true },
        { id: "paymentAmount", title: "Payment Amount", type: "MONEY", editable: true },
        { id: "status", title: "Status", type: "STATUS", editable: true }
      ],
      rows: repository.milestones.map((milestone) => ({ ...milestone }))
    },
    {
      sheetId: "guarantee-register",
      name: "Guarantee Register",
      readOnly,
      mode,
      editable: true,
      allowedRowOperations: ["CREATE", "UPDATE", "DELETE"],
      columns: [
        { id: "code", title: "Guarantee Code", type: "TEXT" },
        { id: "type", title: "Type", type: "TEXT", editable: true },
        { id: "issuedAmount", title: "Issued Amount", type: "MONEY", editable: true },
        { id: "bank", title: "Bank", type: "TEXT", editable: true },
        { id: "status", title: "Status", type: "STATUS", editable: true }
      ],
      rows: repository.guarantees.map((guarantee) => ({ ...guarantee }))
    },
    {
      sheetId: "cashflow-forecast",
      name: "Cashflow Forecast",
      readOnly,
      mode,
      editable: true,
      allowedRowOperations: ["CREATE", "UPDATE", "DELETE"],
      columns: [
        { id: "forecastDate", title: "Forecast Date", type: "DATE", editable: true },
        { id: "type", title: "Type", type: "TEXT" },
        { id: "amount", title: "Amount", type: "MONEY", editable: true },
        { id: "status", title: "Status", type: "STATUS", editable: true }
      ],
      rows: repository.cashflowItems.map((item) => ({ ...item }))
    },
    {
      sheetId: "progress-snapshot",
      name: "Progress Snapshot",
      readOnly,
      mode,
      editable: true,
      allowedRowOperations: ["CREATE", "UPDATE"],
      columns: [
        { id: "projectId", title: "Project", type: "TEXT" },
        { id: "overallPct", title: "Overall", type: "PERCENT", editable: true },
        { id: "updatedBy", title: "Updated By", type: "TEXT", editable: true }
      ],
      rows: repository.progressSnapshots.map((snapshot) => ({ ...snapshot }))
    },
    {
      sheetId: "validation-errors",
      name: "Validation Errors",
      readOnly: true,
      mode,
      columns: [
        { id: "level", title: "Level", type: "STATUS" },
        { id: "message", title: "Message", type: "TEXT" }
      ],
      rows: []
    },
    {
      sheetId: "version-diff",
      name: "Version Diff",
      readOnly: true,
      mode,
      columns: [
        { id: "operation", title: "Operation", type: "STATUS" },
        { id: "description", title: "Description", type: "TEXT" }
      ],
      rows: []
    }
  ];

  return { workbookId: "epc-workbook", activeSheetId: "project-register", sheets, generatedFrom };
}
