# Workbook Edit Mode Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the EPC Control Console baseline documents from read-only-only Workbook behavior to controlled View/Edit Mode, and clarify JSON plus Excel as primary MVP IO formats.

**Architecture:** This is a documentation baseline update only. The new product contract preserves canonical domain data and Git-like commits: Workbook edits create staged changes, then validation, business diff, required commit message, repository update, and projection refresh. JSON snapshot and Excel `.xlsx` import/export become the primary IO formats, with CSV retained as secondary single-sheet support.

**Tech Stack:** Markdown documentation, Git, ripgrep verification.

---

## File Structure

- Modify: `README.md`
  - Purpose: root repository orientation for MVP contributors and GitHub Pages direction.
- Modify: `ref/epc-control-console-md/README.md`
  - Purpose: reference package landing page and decision summary.
- Modify: `ref/epc-control-console-md/00_DECISION_ITEMS.md`
  - Purpose: locked product/technical decisions.
- Modify: `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`
  - Purpose: product goals, MVP scope, views, workflows, and acceptance criteria.
- Modify: `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`
  - Purpose: system architecture, data flow, module boundaries, and stores.
- Modify: `ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md`
  - Purpose: TypeScript interfaces for workbook mode, editability metadata, and edit session data.
- Modify: `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`
  - Purpose: JSON and Excel import/export baseline.
- Modify: `ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md`
  - Purpose: controlled workbook edit workflow in versioning/audit.
- Modify: `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`
  - Purpose: detailed View/Edit Mode behavior.
- Modify: `ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md`
  - Purpose: implementation phases, interfaces, acceptance tests, and risks.

Do not change `ref/epc-control-console-md/09_EPC_CONTROL_TIMELINE.md` read-only timeline wording. The new editability scope is only for Workbook.

---

### Task 1: Update Top-Level Baseline Summaries

**Files:**
- Modify: `README.md`
- Modify: `ref/epc-control-console-md/README.md`

- [ ] **Step 1: Update root README product bullets**

In `README.md`, replace:

```markdown
- XLSX/CSV template import/export
- Git-like in-app commit, branch, tag, diff, and revert
- Read-only Glide workbook
```

with:

```markdown
- JSON repo snapshot import/export
- Excel `.xlsx` full master and periodic update import/export
- CSV current-sheet import/export as secondary support
- Git-like in-app commit, branch, tag, diff, and revert
- Glide Workbook with View/Edit Mode toggle
```

- [ ] **Step 2: Update root README core decisions**

In `README.md`, replace:

```markdown
- Workbook/grid is a read-only projection and IO surface, not the source of truth.
- Canonical domain data is the only business fact source.
- All writes go through Import / Controlled Form -> Validation -> Business Diff -> Commit.
```

with:

```markdown
- Workbook/grid defaults to View Mode and can switch to controlled Edit Mode.
- Workbook cells are not the source of truth; canonical domain data is the only business fact source.
- Workbook edits, imports, and controlled forms all write through Validation -> Business Diff -> Commit.
```

- [ ] **Step 3: Update reference package positioning**

In `ref/epc-control-console-md/README.md`, replace:

```text
EPC Control Console 是一个纯前端、版本化、只读 Workbook 风格的 EPC 项目组合控制系统。
```

with:

```text
EPC Control Console 是一个纯前端、版本化、支持 View/Edit Mode 的 Workbook 风格 EPC 项目组合控制系统。
```

- [ ] **Step 4: Update reference package principles**

In `ref/epc-control-console-md/README.md`, replace:

```text
Excel-like 表格是只读展示层和 IO 入口，不是编辑器，也不是数据源。
Canonical Domain Data 是唯一事实源。
所有写入必须经过 Import / Controlled Form → Validation → Diff → Commit。
```

with:

```text
Excel-like 表格默认是 View Mode 展示层和 IO 入口，可切换到受控 Edit Mode。
Workbook cells 不是数据源；Canonical Domain Data 是唯一事实源。
所有写入必须经过 Workbook Edit / Import / Controlled Form → Validation → Diff → Commit。
```

- [ ] **Step 5: Update reference package decision table**

In `ref/epc-control-console-md/README.md`, replace the table row:

```markdown
| 表格层 | 使用轻量只读 Grid，不采用 Univer 作为默认核心依赖 |
```

with:

```markdown
| 表格层 | Glide Workbook 默认 View Mode，支持受控 Edit Mode，不采用 Univer 作为默认核心依赖 |
```

Replace the IO row:

```markdown
| IO | XLSX / CSV / JSON 模板导入导出 |
```

with:

```markdown
| IO | JSON repo snapshot + Excel `.xlsx` 模板导入导出为主，CSV 单表导入导出为辅 |
```

- [ ] **Step 6: Verify top-level wording**

Run:

```bash
rg -n "Read-only Glide workbook|轻量只读 Grid|只读 Workbook、Glide" README.md ref/epc-control-console-md/README.md
```

Expected: no matches.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add README.md ref/epc-control-console-md/README.md
git commit -m "docs: update workbook baseline summaries"
```

Expected: commit succeeds.

---

### Task 2: Update Decisions and PRD Scope

**Files:**
- Modify: `ref/epc-control-console-md/00_DECISION_ITEMS.md`
- Modify: `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`

- [ ] **Step 1: Update locked workbook decision**

In `ref/epc-control-console-md/00_DECISION_ITEMS.md`, replace D-001:

```markdown
| D-001 | 表格层定位 | Excel-like 只读展示层 + IO 界面，不允许直接编辑单元格 |
```

with:

```markdown
| D-001 | 表格层定位 | Excel-like View/Edit Workbook + IO 界面；默认 View Mode，Edit Mode 的单元格修改必须进入 staging、validation、diff、commit |
```

- [ ] **Step 2: Add workbook edit MVP decision**

In `ref/epc-control-console-md/00_DECISION_ITEMS.md`, after D-112, add:

```markdown
| D-113 | Workbook 编辑模式 | MVP 支持 View/Edit toggle；Edit Mode 可修改字段、新增行、显式删除行，但不得直接写入 canonical repository | Workbook 写入进入 WorkbookEditSession / StagingTransaction，再 validation、diff、commit |
| D-114 | JSON/Excel IO 优先级 | JSON repo snapshot 和 Excel `.xlsx` 模板/报表为主；CSV 为单表辅助格式 | GitHub Pages 静态部署下通过文件上传/下载完成备份、恢复和业务模板流转 |
```

- [ ] **Step 3: Update PRD product goal list**

In `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`, replace:

```text
Excel-like 只读展示
受控 IO
```

with:

```text
Excel-like View/Edit Workbook
受控 Workbook 编辑与 IO
```

- [ ] **Step 4: Update PRD sheet principle**

In `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`, replace section `### 5.1 Sheet 不是数据源` body with:

````markdown
```text
禁止把单元格作为事实源。
禁止直接改单元格并绕过版本提交保存业务数据。
禁止 D3 图表读取 sheet cells。
允许在 Workbook Edit Mode 中修改受控字段、新增行、显式删除行。
Edit Mode 修改必须进入 Validation → Business Diff → Commit。
```
````

- [ ] **Step 5: Update PRD write flow**

In `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`, replace:

```text
Import / Controlled Form
→ Validation
→ Business Diff
→ Commit
→ Projection refresh
```

with:

```text
Workbook Edit / Import / Controlled Form
→ Validation
→ Business Diff
→ Commit
→ Projection refresh
```

- [ ] **Step 6: Update PRD MVP scope**

In `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`, replace:

```text
7. JSON repo import/export
8. XLSX/CSV 模板导入
9. XLSX/CSV 当前视图导出
```

with:

```text
7. JSON repo snapshot import/export
8. Excel `.xlsx` Full Master Data / Periodic Update 模板导入
9. Excel `.xlsx` workbook/report 导出，CSV 当前 sheet 导出作为辅助
```

Replace:

```text
13. 只读 Workbook / Glide Grid
```

with:

```text
13. Glide Workbook View/Edit Mode：View Mode 默认，Edit Mode 支持字段修改、新增行、显式删除行
```

- [ ] **Step 7: Update PRD view description and acceptance**

In `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`, replace Workbook view row:

```markdown
| Workbook | 只读项目台账、节点、现金流、保函、diff、validation |
```

with:

```markdown
| Workbook | View/Edit 项目台账、节点、现金流、保函；diff、validation 和审计 sheet 始终只读 |
```

Replace acceptance criterion 2:

```text
2. 可生成只读 Project Register / Milestone / Cashflow / Guarantee workbook
```

with:

```text
2. 可生成 Project Register / Milestone / Cashflow / Guarantee workbook，并支持 View/Edit Mode 切换
```

Add a new acceptance criterion after item 8:

```text
9. 可在 Workbook Edit Mode 修改允许字段、新增行、显式删除行，并在 commit 前查看 validation 和 business diff
```

Renumber the following acceptance criteria so the final item remains "所有写入均有 commit 记录".

- [ ] **Step 8: Verify decisions and PRD**

Run:

```bash
rg -n "Excel-like 只读展示|只读 Workbook / Glide Grid|Workbook \\| 只读项目台账|可生成只读 Project" ref/epc-control-console-md/00_DECISION_ITEMS.md ref/epc-control-console-md/01_PRD_AND_SCOPE.md
```

Expected: no matches.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add ref/epc-control-console-md/00_DECISION_ITEMS.md ref/epc-control-console-md/01_PRD_AND_SCOPE.md
git commit -m "docs: revise product scope for workbook editing"
```

Expected: commit succeeds.

---

### Task 3: Update Architecture and Domain Models

**Files:**
- Modify: `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`
- Modify: `ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md`

- [ ] **Step 1: Update architecture diagram labels**

In `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`, replace:

```text
│ Glide Grid Adapter | D3 Chart Components | Timeline Renderer │
```

with:

```text
│ Glide Grid Adapter | Workbook Edit Adapter | D3 Components    │
```

Replace:

```text
│ Cashflow Engine | Guarantee Engine | Validation Engine       │
│ Scenario Engine | Diff Engine | Version Engine              │
```

with:

```text
│ Workbook Edit Engine | Cashflow Engine | Guarantee Engine     │
│ Validation Engine | Scenario Engine | Diff Engine | Version  │
```

- [ ] **Step 2: Add workbook edit flow**

In `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`, after section `### 4.2 导入写入流`, add:

````markdown
### 4.2.1 Workbook Edit 写入流

```text
Glide Workbook Edit Mode
→ WorkbookEditSession
→ Cell / Row Operation Mapper
→ Validation Engine
→ StagingTransaction
→ Business Diff
→ Commit Engine
→ Repository update
→ Projection refresh
```

Workbook Edit Mode 不直接写入 IndexedDB domain stores。所有编辑先进入 edit session，再复用 validation、diff 和 commit 管线。
````

- [ ] **Step 3: Update module tree**

In `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`, under `grid/`, add:

```text
 │   ├── editSession.ts
 │   ├── editability.ts
 │   ├── rowOperations.ts
```

so the `grid/` block becomes:

```text
 ├── grid/
 │   ├── GlideWorkbook.tsx
 │   ├── gridAdapter.ts
 │   ├── editSession.ts
 │   ├── editability.ts
 │   ├── rowOperations.ts
 │   ├── cells/
 │   └── microCharts/
```

- [ ] **Step 4: Update IndexedDB stores**

In `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`, add `workbookEditSessions` after `stagingTransactions`:

```text
 ├── stagingTransactions
 ├── workbookEditSessions
 ├── commits
```

- [ ] **Step 5: Update architecture constraints**

In `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`, replace:

```text
2. Glide cells 不得直接写入 IndexedDB
```

with:

```text
2. Glide cells 不得直接写入 IndexedDB domain stores；Edit Mode 只能写入 WorkbookEditSession / StagingTransaction
```

- [ ] **Step 6: Add domain edit models**

In `ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md`, after `## 19. Workbook Projection`, update `SheetViewModel` and `SheetColumn`.

Replace:

```ts
  readOnly: true;
}
```

with:

```ts
  mode: WorkbookMode;
  readOnly: boolean;
  editable?: boolean;
  allowedRowOperations?: WorkbookEditOperation[];
}
```

Add after `SheetColumn`:

```ts
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

- [ ] **Step 7: Verify architecture and model changes**

Run:

```bash
rg -n "WorkbookEditSession|WorkbookMode|WorkbookEditOperation|workbookEditSessions|Edit Mode 只能写入" ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md
```

Expected: at least 8 matches across both files.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md
git commit -m "docs: add workbook edit architecture"
```

Expected: commit succeeds.

---

### Task 4: Update IO and Versioning Docs

**Files:**
- Modify: `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`
- Modify: `ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md`

- [ ] **Step 1: Update IO principle**

In `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`, replace:

```text
Workbook 是 IO 入口，不是编辑器。
用户可以下载模板、导入模板、导出视图。
导入不能直接覆盖数据，必须进入 staging。
导出来自 projection 或 domain snapshot，不从 DOM 抓取。
```

with:

```text
Workbook 是 View/Edit 工作台和 IO 入口，不是 canonical 数据源。
用户可以在 Edit Mode 进行受控编辑，也可以下载模板、导入模板、导出视图。
Workbook 编辑和导入都不能直接覆盖 repository，必须进入 staging。
导出来自 projection 或 domain snapshot，不从 DOM、canvas 或 Glide cells 抓取。
```

- [ ] **Step 2: Update supported file type priority**

In `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`, replace the supported file type table with:

```markdown
| 类型 | 用途 | MVP 优先级 |
|---|---|---|
| JSON | repo snapshot、系统备份、版本库迁移 | Primary |
| XLSX | 标准业务模板、完整 workbook/report，适合 PM/财务使用 | Primary |
| CSV | 单表快速导入导出、当前 sheet 辅助流转 | Secondary |
| ZIP | 可选，用于打包 JSON repo + attachments，MVP 可不做 | Optional |
```

- [ ] **Step 3: Update import flow**

In `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`, before `## 7. 导入冲突处理`, add:

````markdown
### 6.1 Workbook Edit 流程

```text
1. 用户切换到 Edit Mode
2. 用户修改允许字段、新增行或标记删除行
3. 系统记录 WorkbookEditSession
4. 用户点击 Save to Staging
5. Validation Engine 校验 edit session
6. 若无 blocking errors，生成 Business Diff
7. 用户输入 commit message
8. Commit Engine 写入 repository
9. Projection Engine 刷新 Workbook / Dashboard / Timeline
```

Edit Mode 删除必须显式标记，且在 commit 前显示 DELETE diff。
````

- [ ] **Step 4: Update export table**

In `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`, replace:

```markdown
| Export Current View | 当前 Workbook sheet 筛选后的投影 |
| Export Full Portfolio Workbook | 全量只读 workbook |
```

with:

```markdown
| Export Current View | 当前 Workbook sheet 筛选后的投影，支持 Excel `.xlsx`，CSV 为辅助 |
| Export Full Portfolio Workbook | 全量 workbook/report，Excel `.xlsx` 为主 |
```

- [ ] **Step 5: Update version workflow**

In `ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md`, replace:

```text
导入文件或受控操作
→ Validation
→ StagingTransaction
→ BusinessDiff
→ 用户确认
→ Commit
```

with:

```text
Workbook Edit、导入文件或受控操作
→ Validation
→ StagingTransaction
→ BusinessDiff
→ 用户确认并填写 commit message
→ Commit
```

- [ ] **Step 6: Add workbook edit audit rule**

In `ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md`, under `## 14. 审计约束`, add:

```text
8. Workbook Edit Mode 的字段修改、新增行、显式删除行必须记录为 BusinessDiff
9. WorkbookEditSession 不可绕过 commit 写入 canonical repository
```

- [ ] **Step 7: Verify IO/versioning wording**

Run:

```bash
rg -n "Workbook 是 IO 入口，不是编辑器|全量只读 workbook|导入文件或受控操作" ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md
```

Expected: no matches.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md
git commit -m "docs: clarify workbook edits and primary IO"
```

Expected: commit succeeds.

---

### Task 5: Rewrite Workbook and Handoff Specs

**Files:**
- Modify: `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`
- Modify: `ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md`

- [ ] **Step 1: Update Workbook positioning**

In `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`, replace:

```text
只读业务数据展示层
批量 IO 入口
validation / diff 展示层
可复制、筛选、导出的分析表格
```

with:

```text
View Mode 业务数据展示层
Edit Mode 受控业务数据维护入口
批量 IO 入口
validation / diff 展示层
可复制、筛选、编辑、显式删除、导出的分析表格
```

Replace:

```text
可编辑 spreadsheet
公式引擎
事实源
D3 的数据源
```

with:

```text
自由 spreadsheet
公式引擎
事实源
D3 的数据源
绕过 validation / diff / commit 的直接写入入口
```

- [ ] **Step 2: Update toolbar controls**

In `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`, add `View/Edit mode toggle` after `Currency indicator: EUR` in the toolbar list:

```text
View/Edit mode toggle
Add row button (Edit Mode only)
Mark delete button (Edit Mode only)
Save to Staging button (Edit Mode only)
Discard edits button (Edit Mode only)
```

- [ ] **Step 3: Replace read-only behavior section**

In `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`, replace the entire section `## 5. Read-only 行为` with:

````markdown
## 5. View/Edit Mode 行为

默认模式：

```text
View Mode
```

View Mode 允许：

```text
排序
筛选
冻结列
列宽调整
复制
查找
导出当前视图
点击项目跳转详情
hover tooltip
选中行
```

Edit Mode 允许：

```text
修改允许字段
新增支持的业务行
显式标记删除支持的业务行
撤销未提交的删除标记
Save to Staging
Discard edits
```

Edit Mode 禁止：

```text
编辑 sourceCommit / hash / id / createdAt / updatedAt
编辑 Validation Errors / Version Diff / Commit History 等审计 sheet
编辑系统生成且无 canonical entity 映射的 projection rows
用粘贴绕过 schema mapper 和 validation
写公式
直接写入 IndexedDB repository stores
```

用户尝试编辑锁定单元格时提示：

```text
This cell is locked. Workbook edits must target editable business fields and be committed through validation and diff.
```

用户保存编辑时：

```text
WorkbookEditSession
→ Validation
→ Business Diff
→ Required commit message
→ Commit
```
````

- [ ] **Step 4: Add editable scope section**

In `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`, after the View/Edit Mode section, add:

```markdown
## 5.1 Editable Sheet Scope

| Sheet | Edit fields | Add row | Explicit delete |
|---|---|---:|---:|
| Project Register | Yes, except audit/system fields | Yes | No in MVP |
| Project Phases | Yes, except audit/system fields | Yes | Yes |
| Milestone Receivable Plan | Yes, except audit/system fields | Yes | Yes |
| Guarantee Register | Yes, except audit/system fields | Yes | Yes |
| Cashflow Forecast | Manual adjustment and forecast/status fields only | Manual adjustment only | Manual adjustment only |
| Progress Snapshot | Yes, except audit/system fields | Yes | No in MVP |
| Validation Errors | No | No | No |
| Version Diff | No | No | No |
```

- [ ] **Step 5: Update Workbook projection note**

In `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`, replace:

```text
禁止：

Glide cells → Canonical Data
```

with:

```text
禁止：

Glide cells → Canonical Data

允许：

Glide Edit Mode → WorkbookEditSession → StagingTransaction → Validation → BusinessDiff → Commit → Canonical Data
```

- [ ] **Step 6: Update Handoff overview**

In `ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md`, replace:

```text
只读 Glide Workbook
XLSX/CSV/JSON IO
```

with:

```text
Glide Workbook View/Edit Mode
JSON repo snapshot IO
Excel `.xlsx` template/report IO
CSV current-sheet auxiliary IO
```

- [ ] **Step 7: Update Phase 4 deliverables and acceptance**

In `ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md`, under Phase 4 deliverables, add:

```text
View/Edit mode toggle
Workbook edit session
Editable field metadata
Add row / Mark delete / Undo delete
Save to Staging
Locked cell messaging
```

Replace Phase 4 acceptance:

```text
Workbook 不可编辑
可筛选/排序/复制/导出
```

with:

```text
Workbook 默认 View Mode
可切换 Edit Mode
Edit Mode 可修改允许字段、新增行、显式删除行
编辑保存后进入 validation / diff / commit，不直接写入 repository
可筛选/排序/复制/导出
```

- [ ] **Step 8: Replace read-only grid acceptance test**

In `ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md`, replace section `### 5.2 Read-only Grid` with:

````markdown
### 5.2 Workbook View/Edit Mode

```text
Given Workbook is open
When user views a business sheet
Then View Mode is active by default

Given user switches to Edit Mode
When user updates an editable business field
Then canonical domain data does not change immediately
And a WorkbookEditSession records the change
And Save to Staging generates validation issues and business diff

Given user marks a supported row for delete
When user saves to staging
Then a DELETE business diff is shown
And the row is not removed from repository until commit

Given user edits a locked field
When the edit is attempted
Then the edit is rejected
And a locked-cell message is shown
```
````

- [ ] **Step 9: Verify Workbook/Handoff wording**

Run:

```bash
rg -n "Read-only 行为|Workbook 不可编辑|Read-only Grid|只读 Glide Workbook" ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md
```

Expected: no matches.

- [ ] **Step 10: Commit Task 5**

Run:

```bash
git add ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md
git commit -m "docs: specify workbook view edit mode"
```

Expected: commit succeeds.

---

### Task 6: Final Verification and Push

**Files:**
- Read/verify all modified documentation files.

- [ ] **Step 1: Verify old workbook-only-readonly baseline is removed from editable docs**

Run:

```bash
rg -n "只读 Workbook|只读 Glide Workbook|Read-only Grid|Workbook 不可编辑|Excel-like 只读展示|不允许直接编辑单元格|Workbook 是 IO 入口，不是编辑器" README.md ref/epc-control-console-md/00_DECISION_ITEMS.md ref/epc-control-console-md/01_PRD_AND_SCOPE.md ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md
```

Expected: no matches.

- [ ] **Step 2: Verify timeline remains read-only**

Run:

```bash
rg -n "只读 timeline|只读视图|不做拖拽|Timeline 不读取 Workbook cells" ref/epc-control-console-md/09_EPC_CONTROL_TIMELINE.md
```

Expected: matches remain, because Timeline editability is out of scope.

- [ ] **Step 3: Verify JSON and Excel are primary IO**

Run:

```bash
rg -n "JSON repo snapshot|Excel `?\\.xlsx`?|CSV.*Secondary|CSV.*辅助|JSON.*Primary|XLSX.*Primary" README.md ref/epc-control-console-md/README.md ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md
```

Expected: matches in all four files.

- [ ] **Step 4: Verify working tree and commit history**

Run:

```bash
git status --short --branch
git log --oneline --decorate -6
```

Expected: working tree clean; latest commits include Task 1 through Task 5.

- [ ] **Step 5: Push to remote**

Run:

```bash
git push origin main
```

Expected: push succeeds and `main` updates on GitHub.
