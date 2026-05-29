# 03. Domain Data Model

版本：Baseline 0.2  
日期：2026-05-29

## 1. 模型原则

```text
Project / Milestone / Guarantee / Cashflow / Progress 是事实源。
Workbook rows / D3 data / Timeline rows 是 projection。
Projection 不可反向成为事实源。
```

所有实体建议包含：

```ts
interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceCommitId?: string;
}
```

## 2. Project

```ts
export type ProjectStatus =
  | "BIDDING"
  | "SIGNED"
  | "ENGINEERING"
  | "PROCUREMENT"
  | "CONSTRUCTION"
  | "COMMISSIONING"
  | "COMPLETED"
  | "SUSPENDED"
  | "CANCELLED";

export interface Project extends BaseEntity {
  code: string;
  name: string;

  pm: string;
  location: string;
  content: string;
  capacityKWh: number;

  customer?: string;
  contractAmount: number;
  currency: string;

  startDate?: string;
  plannedCOD?: string;
  forecastCOD?: string;
  actualCOD?: string;

  status: ProjectStatus;

  notes?: string;
}
```

唯一键：

```text
Project.code
```

## 3. Project Phase

用于 EPC Control Timeline 和进度分解。

```ts
export type ProjectPhaseType =
  | "ENGINEERING"
  | "PROCUREMENT"
  | "CONSTRUCTION"
  | "COMMISSIONING"
  | "OTHER";

export interface ProjectPhase extends BaseEntity {
  projectId: string;
  phaseType: ProjectPhaseType;
  name: string;
  sequence: number;

  baselineStartDate?: string;
  baselineEndDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  forecastStartDate?: string;
  forecastEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;

  progressPct?: number;
  status: "PLANNED" | "ON_TRACK" | "DELAYED" | "COMPLETED";
}
```

## 4. Milestone

```ts
export type MilestoneStatus =
  | "PLANNED"
  | "REACHED"
  | "INVOICED"
  | "PAID"
  | "DELAYED"
  | "CANCELLED";

export interface Milestone extends BaseEntity {
  projectId: string;
  code: string;
  sequence: number;
  name: string;

  phaseType?: ProjectPhaseType;
  progressTriggerPct?: number;

  baselineDate?: string;
  plannedDate: string;
  forecastDate?: string;
  actualDate?: string;

  paymentPct?: number;
  paymentAmount?: number;
  paymentTermsDays?: number;

  requiresGuarantee: boolean;
  guaranteeType?: GuaranteeType;
  guaranteeAmount?: number;
  guaranteePct?: number;

  status: MilestoneStatus;
  notes?: string;
}
```

唯一键：

```text
projectId + code
```

## 5. Progress Snapshot

```ts
export interface ProgressSnapshot extends BaseEntity {
  projectId: string;
  asOfDate: string;

  engineeringPct?: number;
  procurementPct?: number;
  constructionPct?: number;
  commissioningPct?: number;

  overallPct: number;

  updatedBy?: string;
  comment?: string;
}
```

唯一键建议：

```text
projectId + asOfDate
```

## 6. Guarantee

```ts
export type GuaranteeType =
  | "ADVANCE_PAYMENT"
  | "PERFORMANCE"
  | "WARRANTY"
  | "RETENTION"
  | "OTHER";

export type GuaranteeStatus =
  | "REQUIRED"
  | "ISSUED"
  | "EXPIRED"
  | "RELEASED"
  | "CANCELLED";

export interface Guarantee extends BaseEntity {
  projectId: string;
  milestoneId?: string;
  code: string;

  type: GuaranteeType;
  requiredAmount: number;
  issuedAmount: number;
  currency: string;

  bank?: string;
  bankFacilityId?: string;
  feeRate?: number;

  requiredDate: string;
  issueDate?: string;
  expiryDate?: string;
  releaseDate?: string;

  status: GuaranteeStatus;
  releaseCondition?: string;
  notes?: string;
}
```

唯一键：

```text
projectId + code
```

## 7. Cashflow Item

```ts
export type CashflowType = "INFLOW" | "OUTFLOW";

export type CashflowSource =
  | "AUTO_FROM_MILESTONE"
  | "AUTO_FROM_GUARANTEE_FEE"
  | "MANUAL_ADJUSTMENT"
  | "OPENING_BALANCE";

export type CashflowStatus =
  | "PLANNED"
  | "INVOICED"
  | "RECEIVED"
  | "OVERDUE"
  | "CANCELLED";

export interface CashflowItem extends BaseEntity {
  projectId: string;
  milestoneId?: string;
  guaranteeId?: string;

  type: CashflowType;
  source: CashflowSource;

  plannedDate: string;
  forecastDate: string;
  invoiceDate?: string;
  actualDate?: string;

  amount: number;
  currency: string;
  probability?: number;

  status: CashflowStatus;
  scenarioId: string;

  notes?: string;
}
```

## 8. Scenario

```ts
export interface Scenario extends BaseEntity {
  code: string;
  name: string;
  description?: string;

  baseScenarioId?: string;
  isDefault?: boolean;

  assumptions: {
    paymentDelayDays?: number;
    collectionProbabilityMultiplier?: number;
    guaranteeIssueDelayDays?: number;
    fxRateSetId?: string;
  };
}
```

建议默认场景：

```text
base
conservative
optimistic
```

## 9. FX Rate

MVP 默认汇总币种为 `EUR`。项目数据可以先统一使用 EUR；下列模型用于后续多币种与手工 FX table 扩展。

```ts
export interface FxRate extends BaseEntity {
  baseCurrency: "EUR";
  quoteCurrency: string;
  rate: number;
  asOfDate: string;
  source: "MANUAL" | "IMPORTED";
}
```

MVP 默认：

```text
baseCurrency = EUR
```

说明：第一版 Dashboard 汇总、保函敞口、现金流总览默认使用 EUR。数据模型保留 `currency` 与 `FxRate`，用于后续扩展多币种项目和手工汇率换算。


## 10. App Settings

```ts
export interface AppSettings extends BaseEntity {
  baseCurrency: "EUR";

  currentUser: {
    name: string;
    email?: string;
  };

  defaultScenarioCode: "base" | "conservative" | "optimistic";
  defaultGuaranteeExposureMetric: "ISSUED_EXPOSURE";

  chartDefaults: {
    horizonMonths: 12 | 24 | 36;
    timeGrain: "MONTH";
    guaranteeStackMode: "PROJECT" | "PM" | "LOCATION" | "BANK" | "GUARANTEE_TYPE";
  };
}
```

MVP 默认：

```text
baseCurrency = EUR
正式登录权限不进入 MVP
currentUser 仅用于 commit author、importedBy、exportedBy、tag createdBy
```

## 11. Bank Facility

可选模型，用于银行额度管理。

```ts
export interface BankFacility extends BaseEntity {
  bank: string;
  facilityCode: string;
  currency: string;
  limitAmount: number;
  effectiveDate?: string;
  expiryDate?: string;
  notes?: string;
}
```

## 12. Import Batch

```ts
export interface ImportBatch extends BaseEntity {
  sourceFileName: string;
  sourceFileType: "XLSX" | "CSV" | "JSON";
  importedAt: string;
  importedBy: string;

  projects: ProjectImportRow[];
  milestones: MilestoneImportRow[];
  progressUpdates: ProgressImportRow[];
  guaranteeUpdates: GuaranteeImportRow[];
  cashCollectionUpdates: CashCollectionImportRow[];
  manualCashflowAdjustments: CashflowAdjustmentImportRow[];
}
```

## 13. Validation Error

```ts
export type ValidationLevel = "ERROR" | "WARNING" | "INFO";

export interface ValidationIssue {
  id: string;
  level: ValidationLevel;
  sheetName?: string;
  rowNumber?: number;
  entityType?: string;
  entityCode?: string;
  field?: string;
  message: string;
  suggestedFix?: string;
}
```

## 14. Business Diff

```ts
export type DiffOperation = "CREATE" | "UPDATE" | "DELETE";

export interface BusinessDiff {
  id: string;
  operation: DiffOperation;

  entityType:
    | "PROJECT"
    | "PROJECT_PHASE"
    | "MILESTONE"
    | "PROGRESS_SNAPSHOT"
    | "GUARANTEE"
    | "CASHFLOW_ITEM"
    | "SCENARIO"
    | "FX_RATE";

  entityId?: string;
  entityCode?: string;

  field?: string;
  oldValue?: unknown;
  newValue?: unknown;

  cashflowImpact?: number;
  guaranteeImpact?: number;
  currency?: string;

  description: string;
}
```

## 15. Staging Transaction

```ts
export interface StagingTransaction extends BaseEntity {
  baseCommitId: string;
  branch: string;
  importBatchId?: string;

  validationIssues: ValidationIssue[];
  diff: BusinessDiff[];

  status:
    | "STAGED"
    | "INVALID"
    | "READY_TO_COMMIT"
    | "COMMITTED"
    | "DISCARDED";
}
```

## 16. Version Commit

```ts
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
    currency: string;
  };

  changedEntityIds: string[];
}
```

## 17. Branch

```ts
export interface Branch extends BaseEntity {
  name: string;
  headCommitHash: string;
  baseCommitHash?: string;
  description?: string;
  isDefault?: boolean;
}
```

## 18. Tag

```ts
export interface VersionTag extends BaseEntity {
  name: string;
  commitHash: string;
  description?: string;
  tagType: "MONTH_END" | "BOARD_PACK" | "FORECAST" | "RELEASE" | "OTHER";
  createdBy: string;
}
```

## 19. Workbook Projection

```ts
export interface WorkbookViewModel {
  workbookId: string;
  activeSheetId: string;
  sheets: SheetViewModel[];
  generatedFrom: {
    branch: string;
    commitHash: string;
    tag?: string;
    scenarioId: string;
    generatedAt: string;
  };
}

export interface SheetViewModel {
  sheetId: string;
  name: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
  frozenColumns?: number;
  filters?: boolean;
  mode: WorkbookMode;
  readOnly: boolean;
  editable?: boolean;
  allowedRowOperations?: WorkbookEditOperation[];
}

export interface SheetColumn {
  id: string;
  title: string;
  type:
    | "TEXT"
    | "MONEY"
    | "PERCENT"
    | "DATE"
    | "STATUS"
    | "BADGE"
    | "MICRO_CHART"
    | "COMMIT_HASH";
  width?: number;
  align?: "left" | "right" | "center";
}

export type WorkbookMode = "VIEW" | "EDIT";

export type WorkbookEditOperation = "CREATE" | "UPDATE" | "DELETE";

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

export interface WorkbookCellChange {
  id: string;
  entityType: BusinessDiff["entityType"];
  entityId?: string;
  entityCode?: string;
  field: string;
  oldValue?: unknown;
  newValue: unknown;
}

export interface WorkbookRowOperation {
  id: string;
  operation: WorkbookEditOperation;
  entityType: BusinessDiff["entityType"];
  entityId?: string;
  entityCode?: string;
  draftRow?: Record<string, unknown>;
}
```

## 20. Micro Chart Projection

```ts
export interface MicroChartPoint {
  period: string;
  value: number;
  actual?: boolean;
  forecast?: boolean;
  risk?: "LOW" | "MEDIUM" | "HIGH";
}

export interface MicroChartSeries {
  type: "BAR" | "LINE" | "AREA" | "STEP" | "MARKER";
  points: MicroChartPoint[];
  yMin?: number;
  yMax?: number;
  comparisonMode?: "ROW_NORMALIZED" | "COLUMN_NORMALIZED";
  currency?: string;
  unit?: string;
}
```

## 21. Timeline Projection

```ts
export type TimelineRowType =
  | "PROJECT"
  | "PHASE"
  | "MILESTONE"
  | "PAYMENT"
  | "GUARANTEE";

export interface EpcTimelineRow {
  id: string;
  projectId: string;
  parentId?: string;
  depth: number;
  type: TimelineRowType;

  label: string;
  pm?: string;
  location?: string;
  content?: string;

  startDate?: string;
  endDate?: string;
  baselineStartDate?: string;
  baselineEndDate?: string;

  progressPct?: number;
  amount?: number;
  currency?: string;

  status:
    | "PLANNED"
    | "ON_TRACK"
    | "DELAYED"
    | "DUE_SOON"
    | "COMPLETED"
    | "PAID"
    | "GUARANTEE_REQUIRED"
    | "GUARANTEE_ISSUED"
    | "GUARANTEE_RELEASED";

  cashflowImpact?: number;
  guaranteeExposure?: number;

  sourceEntityType:
    | "PROJECT"
    | "PROJECT_PHASE"
    | "MILESTONE"
    | "CASHFLOW"
    | "GUARANTEE"
    | "PROGRESS";
  sourceEntityId: string;
}
```


## 21. 关键业务规则

```text
1. Project.code 必须唯一
2. Milestone 在同一 Project 内 code 必须唯一
3. 同一项目 paymentPct 合计不得超过 100%，除非显式 override
4. Guarantee.expiryDate 不得早于 issueDate
5. Guarantee.releaseDate 不得早于 issueDate
6. Guarantee.status = ISSUED 时 issuedAmount 必须大于 0
7. Cashflow.actualDate 不得早于 invoiceDate，除非 manual override
8. requiredDate 已到但未 issued 的 guarantee 进入 warning
9. overdue cashflow 由 forecastDate / dueDate 与当前 asOfDate 比较生成
10. 删除必须显式 deleteFlag，不允许隐式删除
```
