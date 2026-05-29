# 06. Workbook and Grid Spec

版本：Baseline 0.2  
日期：2026-05-29

## 1. 定位

Workbook 是：

```text
只读业务数据展示层
批量 IO 入口
validation / diff 展示层
可复制、筛选、导出的分析表格
```

Workbook 不是：

```text
可编辑 spreadsheet
公式引擎
事实源
D3 的数据源
```

## 2. 默认技术

```text
Grid: Glide Data Grid
Shell: React custom workbook shell
Tabs: 自研 sheet tabs
Toolbar: shadcn/ui
Icons: Lucide
```

## 3. 顶部工具栏

建议包含：

```text
Branch selector
Scenario selector
Commit/tag indicator
Horizon selector
Currency indicator: EUR，后续多币种扩展时再升级为 selector, default EUR
Import button
Export button
Validate button
Show Diff button
Commit button
```

## 4. Sheet 列表

MVP Workbook sheets：

```text
Portfolio Summary
Project Register
Project Phases
Milestone Receivable Plan
Guarantee Register
Cashflow Forecast
Progress Snapshot
Validation Errors
Version Diff
```

## 5. Read-only 行为

禁止：

```text
直接改单元格
删除行
插入行
粘贴覆盖数据
拖拽填充
写公式
```

允许：

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

用户尝试编辑时提示：

```text
This workbook is read-only. To update data, import a template or create a controlled adjustment.
```

## 6. 表格视觉规格

```text
Header height: 34px
Row height: 32px
Compact row height: 28px
Group row height: 36px
Cell horizontal padding: 8px
Font size: 12.5px / 13px
Header font size: 11.5px / 12px
Selected row: #E3F2FD
Active cell border: #1565C0
Frozen column separator: subtle blue shadow
```

## 7. 列类型

| 类型 | 样式 |
|---|---|
| Project Code | monospace + blue link |
| Money | right aligned + tabular nums |
| Percent | right aligned + optional progress bar |
| Date | compact ISO date |
| Status | shadcn Badge |
| Risk | icon + badge |
| Commit Hash | monospace short hash |
| Micro Chart | custom canvas cell |
| Diff | old/new value pair |

## 8. Project Register Sheet

Columns：

```text
Project Code
Project Name
PM
Location
Content
kWh
Customer
Contract Amount
Currency
Current Progress
Status
Planned COD
Forecast COD
Actual COD
Cash In 12M        # micro chart
Net Cash 12M       # micro chart
Guarantee 12M      # micro chart
Progress Trend     # micro chart
Risk
Source Commit
```

## 9. Milestone Receivable Plan Sheet

Columns：

```text
Project Code
Milestone Code
Milestone Name
Phase
Trigger Progress %
Baseline Date
Planned Date
Forecast Date
Actual Date
Payment %
Payment Amount
Payment Terms Days
Forecast Cash In Date
Invoice Status
Payment Status
Cashflow Impact
Guarantee Required
Source Commit
```

## 10. Guarantee Register Sheet

Columns：

```text
Project Code
Milestone Code
Guarantee Code
Guarantee Type
Required Amount
Issued Amount
Currency
Bank
Fee Rate
Required Date
Issue Date
Expiry Date
Release Date
Status
Exposure Amount
Fee Forecast
Exposure Curve      # micro area chart
Expiry Risk         # badge or marker
Source Commit
```

## 11. Cashflow Forecast Sheet

Columns：

```text
Month
Project Code
PM
Location
Content
kWh
Cashflow Type
Source
Planned Date
Forecast Date
Actual Date
Forecast Amount
Actual Amount
Currency
Probability
Scenario
Status
Monthly Pattern     # micro bar/line
Source Commit
```

## 12. Validation Errors Sheet

Columns：

```text
Level
Source Sheet
Row Number
Entity Type
Entity Code
Field
Message
Suggested Fix
```

排序默认：

```text
ERROR first
then WARNING
then sourceSheet + rowNumber
```

## 13. Version Diff Sheet

Columns：

```text
Operation
Entity Type
Entity Code
Field
Old Value
New Value
Cashflow Impact
Guarantee Impact
Currency
Description
Commit
Author
Changed At
```

## 14. Micro Chart Cells

### 14.1 类型

```text
Bar Sparkline
Line Sparkline
Area Sparkline
Step Sparkline
Marker Timeline
```

### 14.2 推荐使用

| 数据 | 微图 |
|---|---|
| 月度现金流入 | bar |
| 月度净现金流 | positive/negative bar |
| 累计现金流 | line |
| 保函敞口 | area |
| 项目进度 | line |
| 银行额度占用 | progress bar |
| 节点事件 | marker timeline |

### 14.3 数据结构

```ts
export type MicroChartCellData = {
  kind: "micro-chart-cell";
  chartType: "bar" | "line" | "area" | "step" | "marker";
  values: number[];
  labels: string[];
  yMin?: number;
  yMax?: number;
  showZeroLine?: boolean;
  actualUntilIndex?: number;
  riskIndexes?: number[];
  tooltipTitle?: string;
};
```

### 14.4 比例尺

必须支持：

```text
COLUMN_NORMALIZED: 同一列统一 scale，适合比较规模
ROW_NORMALIZED: 每行独立 scale，适合比较形状
```

默认：

```text
COLUMN_NORMALIZED
```

## 15. Workbook Projection

```text
Canonical Data
→ Workbook Projection
→ SheetViewModel[]
→ Glide Renderer
```

禁止：

```text
Glide cells → Canonical Data
```

## 16. Interaction

### 16.1 点击项目代码

```text
打开 Project Detail Drawer
```

### 16.2 点击保函状态

```text
打开 Guarantee Detail Drawer
```

### 16.3 点击 commit hash

```text
打开 Commit Detail Drawer
```

### 16.4 点击 micro chart

```text
打开相应 D3 详情图或 tooltip
```

## 17. 导出

导出不从 DOM 或 canvas 抓取，必须从 projection 数据导出：

```text
SheetViewModel.rows
→ Export Builder
→ XLSX / CSV
```

## 18. 错误状态

Workbook 应支持：

```text
No data state
Import required state
Validation errors state
Projection generation failed state
Storage unavailable state
```
