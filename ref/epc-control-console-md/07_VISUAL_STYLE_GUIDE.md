# 07. Visual Style Guide

版本：Baseline 0.2  
日期：2026-05-29

## 1. 视觉定位

```text
Clean financial operations interface
高密度、克制、可审计、偏专业金融/工程控制台
```

关键词：

```text
Dense
Structured
Auditable
Neutral
Risk-aware
Version-aware
Cashflow-first
```

## 2. 字体

```css
:root {
  --font-sans: "Roboto", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
  --font-mono: "Roboto Mono", "SFMono-Regular", Consolas, monospace;
}

html {
  font-family: var(--font-sans);
  font-feature-settings: "tnum" 1, "lnum" 1;
}

.code,
.commit-hash,
.project-code {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}
```

字号建议：

| 用途 | 字号 | 行高 |
|---|---:|---:|
| 页面标题 | 20px / 22px | 28px |
| Section 标题 | 16px | 24px |
| Card 标题 | 14px | 20px |
| 表格正文 | 12.5px / 13px | 20px |
| 表格 Header | 12px | 18px |
| 图表 Axis | 11px / 12px | 16px |
| Badge / Meta | 11px | 16px |
| Tooltip | 12px | 18px |

## 3. 图标

```text
Library: lucide-react
Default size: 16px
Toolbar icon: 18px
Stroke width: 1.75 or 2
```

图标映射：

| 功能 | Lucide icon |
|---|---|
| Dashboard | LayoutDashboard |
| Workbook | Table2 |
| Timeline | GanttChart / CalendarRange |
| Cashflow | TrendingUp / ChartNoAxesCombined |
| Guarantees | ShieldCheck |
| Bank | Landmark |
| Versions | GitBranch / GitCommit / History |
| Import | Upload |
| Export | Download |
| Diff | GitCompare |
| Commit | CheckCircle2 |
| Revert | RotateCcw |
| Warning | TriangleAlert |
| Overdue | ClockAlert |
| Paid | CircleDollarSign |
| Filter | SlidersHorizontal |

## 4. 主色与梯度

```text
Primary Brand Color: #1565C0
Secondary Brand Color: #90CAF9
Gradient: #1565C0 → #42A5F5 → #90CAF9
```

Blue scale：

```css
:root {
  --brand-50:  #E3F2FD;
  --brand-100: #BBDEFB;
  --brand-200: #90CAF9;
  --brand-300: #64B5F6;
  --brand-400: #42A5F5;
  --brand-500: #2196F3;
  --brand-600: #1E88E5;
  --brand-700: #1565C0;
  --brand-800: #0D47A1;
  --brand-900: #08306B;

  --brand-primary: #1565C0;
  --brand-primary-light: #90CAF9;

  --brand-gradient: linear-gradient(
    135deg,
    #1565C0 0%,
    #42A5F5 56%,
    #90CAF9 100%
  );

  --brand-gradient-soft: linear-gradient(
    135deg,
    rgba(21, 101, 192, 0.14) 0%,
    rgba(66, 165, 245, 0.10) 55%,
    rgba(144, 202, 249, 0.18) 100%
  );
}
```

## 5. shadcn Theme Tokens

```css
:root {
  --background: #F8FAFC;
  --foreground: #172033;

  --card: #FFFFFF;
  --card-foreground: #172033;

  --popover: #FFFFFF;
  --popover-foreground: #172033;

  --primary: #1565C0;
  --primary-foreground: #FFFFFF;

  --secondary: #E3F2FD;
  --secondary-foreground: #0D47A1;

  --muted: #F1F5F9;
  --muted-foreground: #64748B;

  --accent: #E3F2FD;
  --accent-foreground: #0D47A1;

  --border: #D8E1EE;
  --input: #D8E1EE;
  --ring: #1565C0;

  --destructive: #D32F2F;
  --destructive-foreground: #FFFFFF;

  --success: #2E7D32;
  --warning: #F9A825;
  --risk-high: #D32F2F;
  --risk-medium: #F9A825;
  --risk-low: #2E7D32;

  --radius: 0.5rem;
}
```

## 6. 图表 Tokens

```css
:root {
  --chart-primary: #1565C0;
  --chart-primary-light: #90CAF9;

  --chart-blue-1: #1565C0;
  --chart-blue-2: #1E88E5;
  --chart-blue-3: #42A5F5;
  --chart-blue-4: #64B5F6;
  --chart-blue-5: #90CAF9;

  --chart-cyan-1: #00838F;
  --chart-cyan-2: #00ACC1;

  --chart-indigo-1: #3949AB;
  --chart-indigo-2: #5C6BC0;

  --chart-purple-1: #7E57C2;

  --chart-grid: #E2E8F0;
  --chart-axis: #64748B;
  --chart-tooltip-border: #BBDEFB;
}
```

项目色板：

```ts
export const projectStackPalette = [
  "#1565C0",
  "#1E88E5",
  "#42A5F5",
  "#64B5F6",
  "#90CAF9",
  "#00838F",
  "#00ACC1",
  "#3949AB",
  "#5C6BC0",
  "#7E57C2"
];

export const othersColor = "#94A3B8";
```

## 7. 梯度使用边界

推荐使用：

```text
登录页 / 欢迎页背景
Dashboard 顶部 summary band
核心 KPI hero card
D3 主图面积填充
Stacked area selected layer highlight
Empty state / import success state
```

不推荐使用：

```text
所有按钮
表格 header
所有 chart series
风险状态
Diff added/changed/removed
```

## 8. Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Context Bar                                              │
│ Branch | Scenario | Commit | Period | Currency: EUR | Actions │
├───────────────┬──────────────────────────────────────────────┤
│ Side Nav      │ Main Content                                 │
│ Dashboard     │                                              │
│ Workbook      │                                              │
│ Timeline      │                                              │
│ Cashflow      │                                              │
│ Guarantees    │                                              │
│ Versions      │                                              │
│ Settings      │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

## 9. Top Context Bar

顶部必须显示：

```text
Branch
Scenario
Commit / Tag
Working tree status
Period / Horizon
Currency
```

样式：

```css
.context-pill-active {
  background: #E3F2FD;
  color: #0D47A1;
  border: 1px solid #BBDEFB;
}

.context-primary {
  color: #1565C0;
}
```

## 10. Buttons

主按钮：

```css
.btn-primary {
  background: #1565C0;
  color: #FFFFFF;
}

.btn-primary:hover {
  background: #0D47A1;
}

.btn-primary:focus-visible {
  outline: 2px solid #90CAF9;
  outline-offset: 2px;
}
```

语义：

| 操作 | 样式 |
|---|---|
| Import | primary |
| Commit | primary |
| Export | outline |
| Validate | secondary |
| Revert | warning / outline |
| Delete / Discard | destructive |
| View Diff | outline |

## 11. Badge

```css
.badge-info {
  background: #E3F2FD;
  color: #0D47A1;
  border: 1px solid #BBDEFB;
}

.badge-primary {
  background: #1565C0;
  color: #FFFFFF;
}

.badge-outline-primary {
  background: #FFFFFF;
  color: #1565C0;
  border: 1px solid #90CAF9;
}
```

状态映射：

| 状态 | 样式 |
|---|---|
| ON TRACK | success tint |
| DELAYED | warning |
| OVERDUE | destructive |
| PAID | success |
| REQUIRED | warning outline |
| ISSUED | primary outline |
| RELEASED | muted / success outline |
| EXPIRED | destructive outline |
| COMMITTED | primary |
| TAGGED | outline primary |

## 12. Grid 样式

```css
.grid-project-code {
  color: #1565C0;
  font-family: var(--font-mono);
}

.grid-selected-row {
  background: #E3F2FD;
}

.grid-active-cell {
  border-color: #1565C0;
}

.grid-frozen-separator {
  box-shadow: 6px 0 12px rgba(21, 101, 192, 0.08);
}
```

## 13. 风险色规则

蓝色表示：

```text
品牌
当前选择
信息状态
主趋势
数据流
已开立状态
```

蓝色不表示：

```text
逾期
超限
错误
付款失败
保函过期
```

风险语义：

| 语义 | 颜色 |
|---|---|
| Success / paid / released | green |
| Warning / due soon / required | yellow |
| Error / overdue / expired / exceeded | red |
| Muted / inactive | gray |
