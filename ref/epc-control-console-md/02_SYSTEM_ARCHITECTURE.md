# 02. System Architecture

版本：Baseline 0.2  
日期：2026-05-29

## 1. 架构目标

系统采用纯前端、离线优先、版本化业务数据架构。

核心目标：

```text
轻量表格展示
结构化业务事实源
独立 IO 层
强校验
Git-like 版本管理
D3 多维可视化
可迁移到后端
```

## 2. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│ UI Shell                                                     │
│ shadcn/ui + Lucide + Roboto + Theme Tokens                   │
├──────────────────────────────────────────────────────────────┤
│ Views                                                        │
│ Dashboard | Workbook | Timeline | Cashflow | Guarantee       │
│ Versions | Import Center | Settings                         │
├──────────────────────────────────────────────────────────────┤
│ Presentation Adapters                                        │
│ Glide Grid Adapter | D3 Chart Components | Timeline Renderer │
├──────────────────────────────────────────────────────────────┤
│ Projection Engines                                           │
│ Workbook Projection | Chart Projection | Timeline Projection │
│ MicroChart Projection | Export Projection                   │
├──────────────────────────────────────────────────────────────┤
│ Domain Engines                                               │
│ Cashflow Engine | Guarantee Engine | Validation Engine       │
│ Scenario Engine | Diff Engine | Version Engine              │
├──────────────────────────────────────────────────────────────┤
│ Repository Layer                                             │
│ Domain Repositories | Commit Store | Branch Store | Tag Store│
├──────────────────────────────────────────────────────────────┤
│ Storage                                                      │
│ IndexedDB | Local Settings | JSON Snapshot Import/Export     │
└──────────────────────────────────────────────────────────────┘
```

## 2.1 已锁定 MVP 配置

```ts
export const MVP_CONFIG = {
  baseCurrency: "EUR",
  strictFrontend: true,
  formalAuthentication: false,
  realTimeCollaboration: false,
  defaultGuaranteeExposureMetric: "ISSUED_EXPOSURE",
  enableRequiredExposureToggle: true,
  allowImplicitDeleteOnImport: false,
  requireCommitMessage: true
} as const;
```

这些默认值是开发实现基线。后续引入后端、多币种自动汇率、正式权限或多人协作时，应作为二期扩展，不改变 MVP 的事实源、IO 和版本管理边界。

## 3. 技术栈

| 层 | 技术 |
|---|---|
| Framework | React + TypeScript + Vite |
| UI Components | shadcn/ui |
| Icons | lucide-react |
| Fonts | Roboto + CJK fallback |
| Grid | Glide Data Grid |
| Charts | D3 |
| XLSX IO | SheetJS or equivalent XLSX parser/writer |
| CSV IO | Papa Parse or equivalent CSV parser/writer |
| Storage | IndexedDB |
| State | Zustand / Redux Toolkit / lightweight state store，具体由开发团队评估 |
| Validation | 自研 validation engine，可结合 zod 等 schema 工具 |
| Versioning | 自研 Git-like version engine |

## 4. 数据流

### 4.1 读取展示流

```text
IndexedDB / Repository
→ Domain entities
→ Projection Engine
→ WorkbookViewModel / ChartData / TimelineRows
→ Glide / D3 / Timeline
```

### 4.2 导入写入流

```text
XLSX / CSV / JSON file
→ File Adapter
→ Schema Mapper
→ ImportBatch
→ Validation Engine
→ StagingTransaction
→ Business Diff
→ Commit Engine
→ Repository update
→ Projection refresh
```

### 4.3 版本流

```text
Working data
→ Snapshot normalization
→ Hash
→ Diff summary
→ Commit object
→ Branch head update
→ Tag optional
```

## 5. 模块划分

```text
src/
 ├── app/
 │   ├── App.tsx
 │   ├── routes.tsx
 │   └── providers.tsx
 │
 ├── components/
 │   ├── layout/
 │   ├── navigation/
 │   ├── status/
 │   └── ui/                  # shadcn generated components
 │
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
 │
 ├── domain/
 │   ├── entities/
 │   ├── services/
 │   ├── validation/
 │   ├── engines/
 │   └── projections/
 │
 ├── storage/
 │   ├── indexedDb.ts
 │   ├── repositories.ts
 │   ├── migrations.ts
 │   └── snapshot.ts
 │
 ├── io/
 │   ├── xlsxAdapter.ts
 │   ├── csvAdapter.ts
 │   ├── jsonRepoAdapter.ts
 │   ├── importMapper.ts
 │   └── exportBuilder.ts
 │
 ├── charts/
 │   ├── cashflow/
 │   ├── guarantee/
 │   ├── project/
 │   └── common/
 │
 ├── grid/
 │   ├── GlideWorkbook.tsx
 │   ├── gridAdapter.ts
 │   ├── cells/
 │   └── microCharts/
 │
 ├── styles/
 │   ├── globals.css
 │   ├── theme.css
 │   └── chartTokens.css
 │
 └── utils/
     ├── date.ts
     ├── money.ts
     ├── hash.ts
     ├── ids.ts
     └── arrays.ts
```

## 6. Adapter 原则

系统不得让业务代码直接依赖具体 grid 或 chart 实现。

```ts
export interface WorkbookRendererAdapter {
  render(workbook: WorkbookViewModel): React.ReactNode;
}

export interface ChartRendererAdapter<TData, TOptions> {
  render(data: TData, options: TOptions): React.ReactNode;
}
```

当前默认实现：

```text
WorkbookRendererAdapter → Glide Data Grid
ChartRendererAdapter → D3 React components
```

未来可以替换：

```text
Glide → Univer / Tabulator / RevoGrid
D3 → other chart layer for simple charts
```

## 7. IndexedDB Store 建议

```text
epc_control_console
 ├── projects
 ├── projectPhases
 ├── milestones
 ├── progressSnapshots
 ├── guarantees
 ├── cashflowItems
 ├── scenarios
 ├── fxRates
 ├── importBatches
 ├── stagingTransactions
 ├── commits
 ├── branches
 ├── tags
 ├── snapshots
 └── appSettings
```

建议所有 store 使用：

```text
id: string
createdAt: ISO string
updatedAt: ISO string
sourceCommitId?: string
```

## 8. 纯前端安全边界

MVP 不处理：

```text
服务端认证
服务器审计
服务器权限
企业密钥管理
自动远端同步
```

MVP 处理：

```text
本地版本审计
导入校验
导出备份
repo snapshot 恢复
commit author 记录
```

## 9. 未来后端迁移边界

若后续引入后端，建议保持以下边界不变：

```text
Domain entities 不变
Projection engine 可前端保留
Validation rules 前后端共用或后端复刻
Version objects 不变
Snapshot format 不变
```

后端可新增：

```text
User/Auth API
Repository API
Commit API
File storage API
Audit API
Team collaboration API
```

## 10. 架构约束

```text
1. D3 图表不得从 Glide cells 读取数据
2. Glide cells 不得直接写入 IndexedDB
3. 导入文件不得直接覆盖 repository
4. 所有业务写入必须产生 diff 和 commit
5. 已 tag 的版本不可直接修改
6. 投影视图可以缓存，但不得作为事实源
7. 删除必须显式，不允许模板缺失行导致隐式删除
8. 时间、金额、币种必须经过统一工具函数格式化
```
