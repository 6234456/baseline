export type Currency = "EUR";

export type EntityType =
  | "PROJECT"
  | "PROJECT_PHASE"
  | "MILESTONE"
  | "PROGRESS_SNAPSHOT"
  | "GUARANTEE"
  | "CASHFLOW_ITEM"
  | "SCENARIO"
  | "FX_RATE";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceCommitId?: string;
}

export interface Project extends BaseEntity {
  code: string;
  name: string;
  pm: string;
  location: string;
  content: string;
  capacityKWh: number;
  customer: string;
  contractAmount: number;
  currency: Currency;
  startDate: string;
  plannedCOD: string;
  forecastCOD: string;
  actualCOD?: string;
  status:
    | "BIDDING"
    | "SIGNED"
    | "ENGINEERING"
    | "PROCUREMENT"
    | "CONSTRUCTION"
    | "COMMISSIONING"
    | "COMPLETED"
    | "SUSPENDED"
    | "CANCELLED";
  notes?: string;
}

export interface ProjectPhase extends BaseEntity {
  projectId: string;
  phaseType: "ENGINEERING" | "PROCUREMENT" | "CONSTRUCTION" | "COMMISSIONING" | "OTHER";
  name: string;
  sequence: number;
  baselineStartDate: string;
  baselineEndDate: string;
  forecastStartDate: string;
  forecastEndDate: string;
  progressPct: number;
  status: "PLANNED" | "ON_TRACK" | "DELAYED" | "COMPLETED";
}

export interface Milestone extends BaseEntity {
  projectId: string;
  code: string;
  sequence: number;
  name: string;
  phaseType: ProjectPhase["phaseType"];
  plannedDate: string;
  forecastDate: string;
  paymentPct: number;
  paymentAmount: number;
  paymentTermsDays: number;
  requiresGuarantee: boolean;
  guaranteeType?: Guarantee["type"];
  status: "PLANNED" | "REACHED" | "INVOICED" | "PAID" | "DELAYED" | "CANCELLED";
}

export interface ProgressSnapshot extends BaseEntity {
  projectId: string;
  asOfDate: string;
  engineeringPct: number;
  procurementPct: number;
  constructionPct: number;
  commissioningPct: number;
  overallPct: number;
  updatedBy: string;
  comment?: string;
}

export interface Guarantee extends BaseEntity {
  projectId: string;
  milestoneId?: string;
  code: string;
  type: "ADVANCE_PAYMENT" | "PERFORMANCE" | "WARRANTY" | "RETENTION" | "OTHER";
  requiredAmount: number;
  issuedAmount: number;
  currency: Currency;
  bank: string;
  feeRate: number;
  requiredDate: string;
  issueDate?: string;
  expiryDate?: string;
  releaseDate?: string;
  status: "REQUIRED" | "ISSUED" | "EXPIRED" | "RELEASED" | "CANCELLED";
}

export interface CashflowItem extends BaseEntity {
  projectId: string;
  milestoneId?: string;
  guaranteeId?: string;
  type: "INFLOW" | "OUTFLOW";
  source: "AUTO_FROM_MILESTONE" | "AUTO_FROM_GUARANTEE_FEE" | "MANUAL_ADJUSTMENT" | "OPENING_BALANCE";
  plannedDate: string;
  forecastDate: string;
  invoiceDate?: string;
  actualDate?: string;
  amount: number;
  currency: Currency;
  probability: number;
  status: "PLANNED" | "INVOICED" | "RECEIVED" | "OVERDUE" | "CANCELLED";
  scenarioId: string;
}

export interface Scenario extends BaseEntity {
  code: "base" | "conservative" | "optimistic";
  name: string;
  isDefault?: boolean;
  assumptions: {
    paymentDelayDays?: number;
    collectionProbabilityMultiplier?: number;
    guaranteeIssueDelayDays?: number;
  };
}

export interface AppSettings extends BaseEntity {
  baseCurrency: Currency;
  currentUser: {
    name: string;
    email: string;
  };
  defaultScenarioCode: Scenario["code"];
  defaultGuaranteeExposureMetric: "ISSUED_EXPOSURE";
  chartDefaults: {
    horizonMonths: 12 | 24 | 36;
    timeGrain: "MONTH";
    guaranteeStackMode: "PROJECT" | "PM" | "LOCATION" | "BANK" | "GUARANTEE_TYPE";
  };
}

export interface VersionCommit extends BaseEntity {
  hash: string;
  parentHashes: string[];
  branch: string;
  message: string;
  author: string;
  snapshotHash: string;
  diffSummary: {
    projectsChanged: number;
    milestonesChanged: number;
    guaranteesChanged: number;
    cashflowItemsChanged: number;
    cashflowImpactNext90Days: number;
    guaranteeImpactNext60Days: number;
    overdueReceivableDelta: number;
    currency: Currency;
  };
  changedEntityIds: string[];
}

export interface Branch extends BaseEntity {
  name: string;
  headCommitHash: string;
  baseCommitHash?: string;
  isDefault?: boolean;
}

export interface VersionTag extends BaseEntity {
  name: string;
  commitHash: string;
  tagType: "MONTH_END" | "BOARD_PACK" | "FORECAST" | "RELEASE" | "OTHER";
  createdBy: string;
}

export interface ValidationIssue {
  id: string;
  level: "ERROR" | "WARNING" | "INFO";
  sheetName?: string;
  rowNumber?: number;
  entityType?: string;
  entityCode?: string;
  field?: string;
  message: string;
  suggestedFix?: string;
}

export interface BusinessDiff {
  id: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityType: EntityType;
  entityId?: string;
  entityCode?: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  cashflowImpact?: number;
  guaranteeImpact?: number;
  currency?: Currency;
  description: string;
}

export type WorkbookMode = "VIEW" | "EDIT";
export type WorkbookEditOperation = "CREATE" | "UPDATE" | "DELETE";

export interface WorkbookCellChange {
  id: string;
  entityType: EntityType;
  entityId?: string;
  entityCode?: string;
  field: string;
  oldValue?: unknown;
  newValue: unknown;
}

export interface WorkbookRowOperation {
  id: string;
  operation: WorkbookEditOperation;
  entityType: EntityType;
  entityId?: string;
  entityCode?: string;
  draftRow?: Record<string, unknown>;
}

export interface WorkbookEditSession extends BaseEntity {
  branch: string;
  baseCommitHash: string;
  sheetId: string;
  status: "OPEN" | "VALIDATING" | "READY_TO_COMMIT" | "COMMITTED" | "DISCARDED";
  changes: WorkbookCellChange[];
  rowOperations: WorkbookRowOperation[];
  validationIssues: ValidationIssue[];
  diff: BusinessDiff[];
}

export interface StagingTransaction extends BaseEntity {
  baseCommitId: string;
  branch: string;
  workbookEditSessionId?: string;
  validationIssues: ValidationIssue[];
  diff: BusinessDiff[];
  status: "STAGED" | "INVALID" | "READY_TO_COMMIT" | "COMMITTED" | "DISCARDED";
}

export interface EpcRepository {
  projects: Project[];
  projectPhases: ProjectPhase[];
  milestones: Milestone[];
  progressSnapshots: ProgressSnapshot[];
  guarantees: Guarantee[];
  cashflowItems: CashflowItem[];
  scenarios: Scenario[];
  commits: VersionCommit[];
  branches: Branch[];
  tags: VersionTag[];
  settings: AppSettings;
}

export interface MonthlyCashflowDatum {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
  currency: Currency;
}

export interface GuaranteeExposureSeries {
  key: string;
  values: number[];
}

export interface GuaranteeExposureProjection {
  months: string[];
  series: GuaranteeExposureSeries[];
  totalByMonth: number[];
  currency: Currency;
}

export interface GuaranteeBankInterestDatum {
  bank: string;
  issuedExposure: number;
  annualInterest: number;
  monthlyInterest: number;
  weightedRate: number;
  activeGuaranteeCount: number;
  currency: Currency;
}

export interface DashboardProjection {
  kpis: {
    totalContractValue: number;
    cashInNext90Days: number;
    issuedGuaranteeExposure: number;
    overdueReceivables: number;
    activeProjects: number;
  };
  cashflow: MonthlyCashflowDatum[];
}

export interface SheetColumn {
  id: string;
  title: string;
  type: "TEXT" | "MONEY" | "PERCENT" | "DATE" | "STATUS" | "BADGE" | "COMMIT_HASH" | "CURRENCY" | "SPARKLINE";
  editable?: boolean;
}

export interface SheetViewModel {
  sheetId: string;
  name: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
  mode: WorkbookMode;
  readOnly: boolean;
  editable?: boolean;
  allowedRowOperations?: WorkbookEditOperation[];
}

export interface WorkbookViewModel {
  workbookId: string;
  activeSheetId: string;
  sheets: SheetViewModel[];
  generatedFrom: {
    branch: string;
    commitHash: string;
    scenarioId: string;
    generatedAt: string;
  };
}
