# EPC Control Console 文档包

版本：Baseline 0.2  
日期：2026-05-29  
格式：Markdown  
用途：交付开发团队，用于前端主导的纯 Web 应用开发。若后续引入后端，本文件包中的数据模型、版本模型和 IO 流程可作为 API 与数据库设计基础。

## 当前决策状态

当前 MVP 决策基线已锁定，可直接进入开发拆解。

```text
baseCurrency = EUR
MVP 严格纯前端
MVP 不做正式登录权限，仅 Settings current user 作为 commit author
保函主图默认 Issued Exposure，支持 Required Exposure / Fee Forecast toggle
导入删除不允许隐式删除，必须显式 deleteFlag = TRUE
```

## 项目定位

EPC Control Console 是一个纯前端、版本化、只读 Workbook 风格的 EPC 项目组合控制系统。系统用于同步管理约 20 个 EPC 项目，围绕项目进度、合同金额、PM、location、content、kWh、收款节点、银行保函、现金流预测和版本审计进行数据展示与分析。

核心原则：

```text
Excel-like 表格是只读展示层和 IO 入口，不是编辑器，也不是数据源。
Canonical Domain Data 是唯一事实源。
所有写入必须经过 Import / Controlled Form → Validation → Diff → Commit。
D3 图表和 Glide Workbook 均读取 projection，不互相读取。
```

## 已确认的关键设计

| 类别 | 决策 |
|---|---|
| 应用模式 | 纯前端 Web-based 程序，MVP 不依赖后端服务 |
| 默认币种 | EUR；后续保留多币种与手工 FX table 扩展 |
| 表格层 | 使用轻量只读 Grid，不采用 Univer 作为默认核心依赖 |
| 默认 Grid | Glide Data Grid |
| RevoGrid | Project/Gantt 样式作为视觉与交互参考，不作为 MVP 主依赖 |
| 图表 | D3 自定义图表 |
| 组件 | shadcn/ui |
| 图标 | Lucide icons |
| 字体 | Roboto + CJK fallback，代码/hash 使用 Roboto Mono 或系统等宽字体 |
| 主色 | `#1565C0` |
| 浅色 | `#90CAF9` |
| 梯度 | `#1565C0 → #42A5F5 → #90CAF9` |
| 版本管理 | 应用内 Git-like commit / branch / tag / diff / revert |
| 主存储 | IndexedDB |
| IO | XLSX / CSV / JSON 模板导入导出 |
| 保函敞口主口径 | 默认 Issued Exposure，支持 Required Exposure / Fee Forecast toggle |
| 导入删除规则 | 不允许隐式删除，必须显式 `deleteFlag = TRUE` |
| 重点新增图 | D3 stacked area，用于多项目保函敞口汇总 |

## 文档索引

1. [00_DECISION_ITEMS.md](./00_DECISION_ITEMS.md) — 已锁定开发基线与默认策略
2. [01_PRD_AND_SCOPE.md](./01_PRD_AND_SCOPE.md) — 产品范围、角色、MVP、非目标
3. [02_SYSTEM_ARCHITECTURE.md](./02_SYSTEM_ARCHITECTURE.md) — 系统架构、模块、数据流
4. [03_DOMAIN_DATA_MODEL.md](./03_DOMAIN_DATA_MODEL.md) — 业务数据模型与 TypeScript 接口
5. [04_IO_AND_IMPORT_EXPORT.md](./04_IO_AND_IMPORT_EXPORT.md) — 模板、导入、导出、校验、暂存
6. [05_VERSIONING_AND_AUDIT.md](./05_VERSIONING_AND_AUDIT.md) — Git-like 版本、diff、tag、revert
7. [06_WORKBOOK_AND_GRID_SPEC.md](./06_WORKBOOK_AND_GRID_SPEC.md) — 只读 Workbook、Glide 表格和 micro charts
8. [07_VISUAL_STYLE_GUIDE.md](./07_VISUAL_STYLE_GUIDE.md) — 视觉风格、主题 token、字体、图标、颜色
9. [08_D3_CHART_SPEC.md](./08_D3_CHART_SPEC.md) — D3 图表规格，含 stacked area 保函敞口
10. [09_EPC_CONTROL_TIMELINE.md](./09_EPC_CONTROL_TIMELINE.md) — EPC Control Timeline / Gantt-inspired 视图
11. [10_DEVELOPMENT_HANDOFF.md](./10_DEVELOPMENT_HANDOFF.md) — 开发交付计划、目录结构、验收标准

## 开发团队建议阅读顺序

```text
00_DECISION_ITEMS
01_PRD_AND_SCOPE
02_SYSTEM_ARCHITECTURE
03_DOMAIN_DATA_MODEL
04_IO_AND_IMPORT_EXPORT
05_VERSIONING_AND_AUDIT
06_WORKBOOK_AND_GRID_SPEC
08_D3_CHART_SPEC
10_DEVELOPMENT_HANDOFF
```

视觉实现人员应重点阅读：

```text
07_VISUAL_STYLE_GUIDE
06_WORKBOOK_AND_GRID_SPEC
08_D3_CHART_SPEC
09_EPC_CONTROL_TIMELINE
```
