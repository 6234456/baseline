# 09. EPC Control Timeline

版本：Baseline 0.2  
日期：2026-05-29

## 1. 定位

EPC Control Timeline 是一个 Project/Gantt-inspired 只读视图，用于把项目进度、关键节点、收款、保函开立/释放和现金流影响放在同一条时间线上。

它不是传统项目管理 Gantt，不做拖拽排期，不做完整关键路径计算。

核心问题：

```text
哪些节点触发收款？
哪些节点触发保函？
保函敞口持续到什么时候？
延期会把现金流推迟到哪个月份？
baseline、forecast、actual 的差异在哪里？
```

## 2. 布局

```text
┌─────────────────────────────────────────────────────────────┐
│ Timeline Toolbar                                            │
│ Branch | Scenario | Horizon | Zoom | Filters                │
├───────────────────────┬─────────────────────────────────────┤
│ Project / Task Grid   │ Timeline Canvas / SVG               │
│                       │                                     │
│ EPC-001               │ Jan Feb Mar Apr May Jun Jul Aug     │
│  Engineering          │ ███████                             │
│  Procurement          │      █████████                      │
│  Construction         │            ██████████               │
│  Payment Node 1       │          ◆ Cash In                  │
│  Performance Bond     │       ◇──────────────◇ Release      │
│                       │                                     │
└───────────────────────┴─────────────────────────────────────┘
```

## 3. 技术方案

```text
Left grid: Glide Data Grid or compact custom table
Right timeline: D3 SVG/Canvas
Sync: rowId + rowHeight + scrollTop
```

## 4. Row Types

```ts
export type TimelineRowType =
  | "PROJECT"
  | "PHASE"
  | "MILESTONE"
  | "PAYMENT"
  | "GUARANTEE";
```

## 5. Timeline Row Model

```ts
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

## 6. Row Hierarchy

推荐层级：

```text
Project
 ├── Engineering phase
 ├── Procurement phase
 ├── Construction phase
 ├── Commissioning phase
 ├── Payment milestones
 │    ├── Advance Payment
 │    ├── Mechanical Completion Payment
 │    ├── PAC Payment
 │    └── FAC Payment
 └── Guarantees
      ├── Advance Payment Bond
      ├── Performance Bond
      └── Warranty Bond
```

## 7. 视觉元素

| 元素 | 表现 |
|---|---|
| Project row | 粗体、可折叠、整体周期条 |
| Phase row | 进度条，显示 baseline/forecast |
| Milestone | diamond marker |
| Payment | cash-in marker，显示金额 tooltip |
| Guarantee | exposure bar，issue → release/expiry |
| Baseline | ghost bar |
| Actual | solid marker |
| Forecast | outline marker or lighter bar |
| Delay | warning badge / annotation |
| Due soon | yellow marker |
| Overdue | red marker |

## 8. Timeline Header

支持：

```text
Month header
Quarter grouping
Year grouping
Zoom to week optional
```

默认：

```text
month granularity
```

## 9. 交互

```text
Expand/collapse project
Hover bar/marker → tooltip
Click project → Project Detail Drawer
Click payment marker → Cashflow Detail Drawer
Click guarantee bar → Guarantee Detail Drawer
Brush date range
Filter by PM/location/content/status
Toggle baseline/forecast/actual
```

## 10. Tooltip 示例

### Payment marker

```text
Project: EPC-003
Milestone: PAC
Forecast Cash In: 2026-09-10
Amount: EUR 1.20M
Status: INVOICED
Payment terms: 30 days
Cashflow Impact: shifted from Aug to Sep
Source Commit: a13f29
```

### Guarantee bar

```text
Project: EPC-003
Guarantee: Performance Bond
Bank: Bank A
Issued Amount: EUR 450k
Issue Date: 2026-06-01
Expiry Date: 2026-12-31
Release Condition: FAC achieved
Status: ISSUED
Exposure Duration: 214 days
```

## 11. MVP 范围

包含：

```text
只读 timeline
项目/阶段分组
节点 marker
进度 bar
baseline ghost bar
延期 warning
现金流 marker
保函 exposure bar
点击行打开详情
```

不包含：

```text
拖拽修改时间
拖拽依赖线
资源排程
复杂关键路径
多人协作编辑
```

## 12. Projection 输入

Timeline projection 从以下实体生成：

```text
Project
ProjectPhase
Milestone
CashflowItem
Guarantee
ProgressSnapshot
Scenario
```

## 13. Projection 输出

```ts
export interface EpcTimelineViewModel {
  rows: EpcTimelineRow[];
  range: {
    startDate: string;
    endDate: string;
  };
  generatedFrom: {
    branch: string;
    commitHash: string;
    scenarioId: string;
    generatedAt: string;
  };
}
```

## 14. 状态规则

```text
baselineDate < forecastDate by threshold → DELAYED
cashflow forecastDate < today and status != RECEIVED → OVERDUE
guarantee requiredDate within 60 days and status != ISSUED → DUE_SOON
guarantee expiryDate within 90 days and status == ISSUED → DUE_SOON
releaseDate exists → GUARANTEE_RELEASED
```

## 15. 与其他视图关系

```text
Canonical Data
   ├── Workbook Projection → View/Edit Workbook sheets
   ├── Timeline Projection → EPC Control Timeline
   ├── Chart Projection → D3 Dashboard
   └── Export Projection → XLSX / CSV / JSON
```

Timeline 不读取 Workbook cells。
