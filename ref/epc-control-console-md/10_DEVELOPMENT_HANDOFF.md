# 10. Development Handoff

版本：Baseline 0.2  
日期：2026-05-29

## 1. 交付目标

开发团队需要交付一个纯前端 MVP：

```text
React + TypeScript Web App
IndexedDB 本地版本库
Glide Workbook View/Edit Mode
D3 Dashboard
JSON repo snapshot IO
Excel `.xlsx` template/report IO
CSV current-sheet auxiliary IO
Git-like versioning
shadcn/lucide/Roboto/#1565C0 visual system
```

## 2. 推荐开发阶段

### Phase 0. Project Setup

交付：

```text
Vite + React + TypeScript
shadcn/ui setup
lucide-react setup
Roboto font setup
theme tokens
base layout
route shell
IndexedDB wrapper
```

验收：

```text
应用可运行
Side nav / top context bar 可见
主题颜色正确
基础 shadcn components 可用
```

### Phase 1. Domain + Storage

交付：

```text
Domain entity types
Repository layer
IndexedDB stores
Settings store
Sample seed data
Basic migrations
```

验收：

```text
可载入 20 个 sample EPC projects
刷新浏览器后数据保留
可导出 repo snapshot JSON
可重新导入 snapshot 恢复
```

### Phase 2. IO + Validation + Diff

交付：

```text
XLSX/CSV parser adapter
Full Master Data Template export
Periodic Update Template export
ImportBatch mapper
Validation engine
Business diff engine
Staging transaction UI
```

验收：

```text
可导入 Projects / Milestones / Guarantees / ProgressUpdates
错误行显示在 Validation Errors sheet
无 blocking error 时可查看 Business Diff
不允许导入直接覆盖数据
```

### Phase 3. Version Engine

交付：

```text
Commit engine
Branch engine
Tag engine
Revert commit
Commit history UI
Commit detail drawer
Diff viewer
```

验收：

```text
每次写入都有 commit
可创建 branch
可创建 tag
可从 commit/tag 导出 snapshot
可 revert 某次 commit
```

### Phase 4. Workbook

交付：

```text
Glide Workbook shell
Sheet tabs
Portfolio Summary
Project Register
Project Phases
Milestone Receivable Plan
Guarantee Register
Cashflow Forecast
Progress Snapshot
Validation Errors
Version Diff
Micro chart cells
Export current view
View/Edit mode toggle
Workbook edit session
Editable field metadata
Add row / Mark delete / Undo delete
Save to Staging
Locked cell messaging
```

验收：

```text
Workbook 默认 View Mode
可切换 Edit Mode
Edit Mode 可在支持的 sheet/row 上修改允许字段、新增行、显式删除行
编辑保存后进入 validation / diff / commit，不直接写入 repository
可筛选/排序/复制/导出
Project Code 点击打开详情
Micro chart 正常显示
数据来自 projection
```

### Phase 5. D3 Dashboards

交付：

```text
Portfolio Dashboard
Monthly Cashflow Bar + Cumulative Line
Guarantee Exposure Stacked Area
Guarantee Expiry Heatmap
Project Progress Scatter
Scenario Comparison
```

验收：

```text
图表读取 projection
支持 branch/scenario/horizon
保函 stacked area 支持 Project/PM/Location/Bank/Type stack mode
支持 Top 7 + Others
支持 tooltip 和 legend highlight
```

### Phase 6. EPC Control Timeline

交付：

```text
Timeline projection
Left grid + right D3 timeline
Project/phase/payment/guarantee rows
Baseline/forecast/actual display
Tooltip/detail drawer
```

验收：

```text
可按项目折叠
收款节点和保函周期可见
点击 marker/bar 打开详情
不允许拖拽编辑
```

## 3. 推荐目录结构

```text
src/
 ├── app/
 ├── components/
 ├── modules/
 │   ├── dashboard/
 │   ├── workbook/
 │   ├── timeline/
 │   ├── cashflow/
 │   ├── guarantees/
 │   ├── projects/
 │   ├── milestones/
 │   ├── import-center/
 │   ├── versions/
 │   └── settings/
 ├── domain/
 │   ├── entities/
 │   ├── engines/
 │   ├── projections/
 │   └── validation/
 ├── storage/
 ├── io/
 ├── charts/
 ├── grid/
 ├── styles/
 └── utils/
```

## 4. 核心服务接口

### 4.1 Repository

```ts
export interface EpcRepository {
  getProjects(): Promise<Project[]>;
  saveProjects(projects: Project[]): Promise<void>;

  getMilestones(projectId?: string): Promise<Milestone[]>;
  saveMilestones(milestones: Milestone[]): Promise<void>;

  getGuarantees(projectId?: string): Promise<Guarantee[]>;
  saveGuarantees(guarantees: Guarantee[]): Promise<void>;

  getCashflowItems(projectId?: string, scenarioId?: string): Promise<CashflowItem[]>;
  saveCashflowItems(items: CashflowItem[]): Promise<void>;

  getCurrentBranch(): Promise<Branch>;
  setCurrentBranch(branchName: string): Promise<void>;
}
```

### 4.2 Import Service

```ts
export interface ImportService {
  parseFile(file: File): Promise<ImportBatch>;
  validate(batch: ImportBatch, context: RepositoryContext): Promise<ValidationIssue[]>;
  createStagingTransaction(batch: ImportBatch): Promise<StagingTransaction>;
  generateDiff(transaction: StagingTransaction): Promise<BusinessDiff[]>;
}
```

### 4.3 Version Service

```ts
export interface VersionService {
  commit(transactionId: string, message: string, author: string): Promise<VersionCommit>;
  createBranch(name: string, fromCommitHash: string): Promise<Branch>;
  createTag(name: string, commitHash: string, tagType: VersionTag["tagType"]): Promise<VersionTag>;
  revert(commitHash: string, message: string, author: string): Promise<VersionCommit>;
  getCommitHistory(branch?: string): Promise<VersionCommit[]>;
}
```

### 4.4 Projection Service

```ts
export interface ProjectionService {
  buildWorkbook(input: ProjectionInput): Promise<WorkbookViewModel>;
  buildGuaranteeExposure(input: ProjectionInput): Promise<GuaranteeExposurePoint[]>;
  buildCashflowChart(input: ProjectionInput): Promise<MonthlyCashflowDatum[]>;
  buildTimeline(input: ProjectionInput): Promise<EpcTimelineViewModel>;
}
```

## 5. Acceptance Tests

### 5.1 Data IO

```text
Given a valid Full Master Data Template
When user imports it
Then projects, milestones, guarantees are staged
And validation has no blocking errors
And business diff shows creates
And commit writes data to repository
```

### 5.2 Workbook View/Edit Mode

```text
Given Workbook is open
When user views a business sheet
Then View Mode is active by default

Given user switches to Edit Mode
When user updates an editable business field
Then canonical domain data does not change immediately
And a WorkbookEditSession records the change
And Save to Staging runs validation and shows validation results and business diff

Given user marks a supported row for delete
When user saves to staging
Then a DELETE business diff is shown
And the row is not removed from repository until commit

Given user edits a locked field
When the edit is attempted
Then the edit is rejected
And a locked-cell message is shown
```

### 5.3 Version Commit

```text
Given staged transaction is ready
When user enters commit message and confirms
Then a commit is created
And branch head is updated
And working tree status becomes clean
```

### 5.4 Guarantee Exposure

```text
Given guarantees with issueDate and expiryDate
When user opens Guarantee Dashboard
Then stacked area shows monthly outstanding exposure
And stack mode can change from Project to Bank
And tooltip shows total + top contributors
```

### 5.5 Snapshot Restore

```text
Given an exported repo snapshot
When user imports it into empty app
Then repository is restored
And commit history, branches, tags are available
```

## 6. Quality Requirements

```text
TypeScript strict mode preferred
No direct DOM extraction for export
No chart reads from grid cells
No grid edit writes to storage
All money uses centralized formatter
All dates use ISO storage format
All validation rules unit tested
All projections unit tested with sample data
```

## 7. Performance Targets

数据规模 MVP：

```text
Projects: 20–100
Milestones: 200–1,000
Guarantees: 100–500
CashflowItems: 500–5,000
Commits: 100–1,000
```

目标：

```text
Workbook render: < 1s for MVP data
Chart projection: < 500ms for MVP data
Import validation: < 3s for MVP templates
Snapshot export/import: < 5s for MVP data
```

## 8. Risks

| 风险 | 缓解 |
|---|---|
| 纯前端数据丢失 | JSON snapshot export、IndexedDB backup reminder |
| 用户误以为 View Mode 会直接保存编辑 | 明确 View/Edit Mode、locked cell messaging、validation/diff/commit workflow |
| 图表误导现金流连续性 | 月度现金流用 bar，保函默认 step/linear |
| 多币种汇总错误 | MVP base currency 固定为 EUR；后续通过 FX table + currency display 扩展 |
| 版本逻辑复杂 | 先实现 linear commit + branch/tag，再扩展 merge |
| 依赖库 license | 开发前检查所有第三方依赖许可 |

## 9. 开发基线已确认

以下事项已锁定为 MVP 开发基线：

```text
1. baseCurrency: EUR
2. MVP 严格纯前端
3. MVP 不做正式登录权限，仅 Settings current user 作为 commit author
4. 保函主口径：默认 Issued Exposure，支持 Required Exposure toggle
5. 导入删除规则：只允许显式 deleteFlag，不允许隐式删除
```

开发团队可按 `00_DECISION_ITEMS.md` 直接执行。
