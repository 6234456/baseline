# 08. D3 Chart Spec

版本：Baseline 0.2  
日期：2026-05-29

## 1. 图表原则

所有金额型图表 MVP 默认以 EUR 展示。后续多币种项目通过 FX table 换算后再进入 chart projection。

```text
D3 图表读取 chart projection，不读取 Workbook cells。
图表应服务业务判断，不做无意义装饰。
所有图表必须显示 branch / commit / scenario / horizon 上下文。
金额图表必须显示 currency；MVP 默认显示 EUR。MVP 默认汇总币种为 EUR。MVP default display currency: EUR。
风险语义不得只靠颜色表达，必须有 tooltip / icon / label。
```

## 2. 图表清单

| 图表 | 用途 | MVP |
|---|---|---|
| Monthly Cashflow Bar + Cumulative Line | 月度现金流和累计现金流 | Yes |
| Guarantee Exposure Stacked Area | 多项目保函敞口 | Yes |
| Guarantee Expiry Heatmap | 保函到期集中度 | Yes |
| Project Progress Scatter | 金额、进度、kWh、风险 | Yes |
| EPC Control Timeline | 项目/节点/收款/保函时间线 | Yes |
| Scenario Comparison | base/conservative/optimistic 对比 | Yes |
| PM Portfolio Treemap | PM 管理项目组合 | Optional MVP+ |
| Location Matrix | 地区维度现金流/保函 | Optional MVP+ |
| Version Diff Impact Chart | commit 对现金流/保函影响 | Optional MVP+ |

## 3. 通用 Chart Container

所有图表使用 shadcn Card 容器：

```tsx
<Card>
  <CardHeader>
    <CardTitle>Chart Title</CardTitle>
    <CardDescription>Business description</CardDescription>
    <ChartControls />
  </CardHeader>
  <CardContent>
    <D3Chart />
  </CardContent>
</Card>
```

通用交互：

```text
Hover tooltip
Legend highlight
Export chart data
Date range / horizon selector
Scenario selector
Currency display: EUR
Empty state
Loading state
```

## 4. Monthly Cashflow Bar + Cumulative Line

### 4.1 目的

展示每月现金流入/流出和累计现金流，支持 forecast vs actual。

### 4.2 数据模型

```ts
export interface MonthlyCashflowDatum {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
  actualInflow?: number;
  forecastInflow?: number;
  currency: string;
}
```

### 4.3 视觉

```text
Monthly inflow: bar
Monthly outflow: negative bar
Cumulative: line
Actual: solid
Forecast: dashed or lighter
Overdue annotation: warning marker
```

### 4.4 交互

```text
Hover month → 显示 inflow/outflow/net/cumulative
Click month → drill down to project cashflow rows
Toggle actual / forecast / net
```

## 5. Guarantee Exposure Stacked Area

这是 Guarantee Dashboard 的核心图。

### 5.1 目的

展示未来各月保函敞口总量及其构成，支持按项目、PM、location、bank、guarantee type 堆叠。

### 5.2 Stack Modes

```ts
export type GuaranteeStackMode =
  | "PROJECT"
  | "PM"
  | "LOCATION"
  | "BANK"
  | "GUARANTEE_TYPE";
```

UI：

```text
Stack by: Project / PM / Location / Bank / Guarantee Type
Horizon: 6M / 12M / 24M / 36M
Value: Issued Exposure / Required Exposure / Fee Forecast
Curve: Step / Linear / Smooth
Scenario: Base / Conservative / Optimistic
```

默认：

```text
Stack by: Project
Value: Issued Exposure
Curve: Step or Linear
Horizon: 12M
```

### 5.3 数据模型

```ts
export interface GuaranteeExposurePoint {
  month: string;
  key: string;
  exposure: number;
  requiredExposure: number;
  issuedExposure: number;
  feeForecast: number;
  currency: string;
}

export interface GuaranteeExposureStackDatum {
  month: string;
  total: number;
  [seriesKey: string]: string | number;
}
```

### 5.4 Exposure 计算

```ts
export function isGuaranteeActiveInMonth(
  g: Guarantee,
  monthStart: Date,
  monthEnd: Date
): boolean {
  if (g.status === "CANCELLED") return false;

  const start = g.issueDate ?? g.requiredDate;
  const end = g.releaseDate ?? g.expiryDate;

  if (!start) return false;

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : undefined;

  return startDate <= monthEnd && (!endDate || endDate >= monthStart);
}

export function getExposureAmount(
  g: Guarantee,
  mode: "ISSUED" | "REQUIRED" | "FEE_FORECAST"
): number {
  if (mode === "ISSUED") return g.issuedAmount || 0;
  if (mode === "REQUIRED") return g.requiredAmount || 0;
  return (g.issuedAmount || 0) * (g.feeRate || 0) / 12;
}
```

### 5.5 D3 Stack 生成

```ts
import * as d3 from "d3";

export function buildGuaranteeExposureStack(
  points: GuaranteeExposurePoint[],
  keys: string[]
): GuaranteeExposureStackDatum[] {
  const byMonth = d3.rollups(
    points,
    rows => {
      const datum: GuaranteeExposureStackDatum = {
        month: rows[0].month,
        total: d3.sum(rows, d => d.exposure)
      };

      for (const key of keys) {
        datum[key] = d3.sum(
          rows.filter(d => d.key === key),
          d => d.exposure
        );
      }

      return datum;
    },
    d => d.month
  );

  return byMonth
    .map(([, datum]) => datum)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

export function createStackSeries(
  data: GuaranteeExposureStackDatum[],
  keys: string[]
) {
  return d3
    .stack<GuaranteeExposureStackDatum>()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone)(data);
}
```

### 5.6 Area Generator

```ts
const area = d3
  .area<d3.SeriesPoint<GuaranteeExposureStackDatum>>()
  .x(d => xScale(String(d.data.month)) ?? 0)
  .y0(d => yScale(d[0]))
  .y1(d => yScale(d[1]))
  .curve(d3.curveStepAfter);
```

默认建议使用：

```text
curveStepAfter 或 curveLinear
```

Smooth 只作为用户可选：

```text
d3.curveMonotoneX
```

### 5.7 视觉

```text
Total exposure line: #1565C0
Selected layer: #1565C0
Unselected layers: categorical palette, opacity 0.55
Hover selected layer: opacity 1
Hover other layers: opacity 0.18
Brush selection: rgba(144, 202, 249, 0.24)
Tooltip border: #90CAF9
```

SVG gradient：

```tsx
<defs>
  <linearGradient id="guaranteeExposureGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#1565C0" stopOpacity="0.72" />
    <stop offset="55%" stopColor="#42A5F5" stopOpacity="0.38" />
    <stop offset="100%" stopColor="#90CAF9" stopOpacity="0.12" />
  </linearGradient>
</defs>
```

### 5.8 Top N + Others

默认：

```text
Top 7 projects + Others
```

排序依据：

```text
selected horizon 内 exposure 总额
```

### 5.9 Tooltip

Tooltip 内容：

```text
Month: 2026-08
Total Exposure: EUR 4.82M

Top Contributors:
1. EPC-004    EUR 1.25M    25.9%
2. EPC-011    EUR 0.92M    19.1%
3. EPC-002    EUR 0.73M    15.1%

Required but not issued: EUR 0.48M
Expiring within 60 days: EUR 0.37M
Bank limit usage: 78%
```

### 5.10 交互

```text
Hover month vertical cursor
Hover layer highlight
Click layer → filter workbook/detail to selected project/PM/bank/type
Brush select date range
Toggle normalized 100% stacked area
Export chart data
```

## 6. Guarantee Expiry Heatmap

### 6.1 目的

展示保函到期集中月份。

### 6.2 数据模型

```ts
export interface GuaranteeExpiryHeatmapCell {
  month: string;
  key: string; // project / bank / type / PM
  expiringAmount: number;
  count: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  currency: string;
}
```

### 6.3 视觉

```text
X-axis: Month
Y-axis: Project / Bank / Type
Color intensity: expiringAmount
Risk marker: due soon / overdue
```

## 7. Project Progress Scatter

### 7.1 目的

展示项目金额、进度、kWh、风险之间的关系。

### 7.2 数据模型

```ts
export interface ProjectScatterDatum {
  projectId: string;
  projectCode: string;
  pm: string;
  location: string;
  content: string;
  contractAmount: number;
  capacityKWh: number;
  progressPct: number;
  outstandingGuarantee: number;
  overdueReceivable: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  currency: string;
}
```

### 7.3 视觉

```text
X-axis: progressPct
Y-axis: contractAmount
Bubble size: capacityKWh or outstandingGuarantee
Color: riskLevel or PM
```

## 8. Scenario Comparison

### 8.1 目的

对比 base / conservative / optimistic 的现金流和保函需求。

```ts
export interface ScenarioComparisonDatum {
  month: string;
  scenarioCode: string;
  cashIn: number;
  netCashflow: number;
  guaranteeExposure: number;
  currency: string;
}
```

默认视觉：

```text
multi-line chart
small multiples optional
```

## 9. Version Diff Impact Chart

### 9.1 目的

展示某次 commit 对现金流和保函的影响。

```ts
export interface DiffImpactDatum {
  month: string;
  cashflowDelta: number;
  guaranteeDelta: number;
  currency: string;
}
```

视觉：

```text
positive/negative bar
cashflow delta and guarantee delta toggle
```

## 10. 图表导出

每个图表至少支持：

```text
Export Data CSV
Export Data XLSX
Export SVG/PNG optional
```

MVP 优先：

```text
Export Data CSV/XLSX
```

## 11. 空状态

图表无数据时显示：

```text
No data available for the selected branch, scenario, and horizon.
```

并提供：

```text
Import data
Change filters
Reset horizon
```
