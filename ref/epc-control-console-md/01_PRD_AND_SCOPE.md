# 01. PRD and Scope

版本：Baseline 0.2  
日期：2026-05-29

## 1. 产品名称

```text
EPC Control Console
```

可选中文名：

```text
EPC 项目组合控制台
```

## 2. 产品目标

建立一个纯前端 Web 应用，用于管理约 20 个 EPC 项目的项目进度、合同金额、PM、location、content、kWh、付款节点、银行保函、现金流预测、版本管理和多维可视化。

系统目标不是替代 Excel，而是提供：

```text
Excel-like View/Edit Workbook
受控 Workbook 编辑与 IO
业务规则校验
现金流预测
保函敞口管理
Git-like 版本审计
D3 多维可视化
```


## 2.1 MVP 决策锁定

```text
baseCurrency = EUR
MVP strictly front-end = true
formal authentication = false
real-time collaboration = false
default guarantee exposure metric = Issued Exposure
required exposure toggle = enabled
implicit delete on import = disabled
commit message = required
```

## 3. 目标用户

| 用户角色 | 主要关注点 | 典型操作 |
|---|---|---|
| 管理层 | 项目组合、现金流、保函敞口、风险 | 查看 dashboard、查看趋势、导出汇报 |
| 财务 | 收款节点、实际回款、逾期、银行保函 | 导入回款/保函更新、查看敞口和现金流 |
| PM | 项目进度、节点达成、计划偏差 | 提交进度更新模板、查看项目详情 |
| 项目控制 | 版本、diff、月结、预测口径 | 维护数据、提交 commit、生成 tag |
| 开发/运维 | 数据结构、导入导出、部署 | 维护应用、处理备份、支持升级 |

## 4. 核心业务问题

系统应回答以下问题：

```text
未来 6/12/24 个月的现金流入在哪里？
哪些项目的收款延后影响最大？
当前已开立保函敞口是多少？
哪些项目、PM、location、bank 或 guarantee type 占用最多？
未来 30/60/90 天有哪些保函需要开立或到期？
哪些付款节点需要银行保函作为条件？
项目进度变化对现金流和保函需求有什么影响？
当前数据版本和上一个月结版本有什么差异？
某个金额/日期/保函状态是谁在哪次 commit 中改变的？
```

## 5. 产品原则

### 5.1 Sheet 不是数据源

```text
禁止把单元格作为事实源。
禁止直接改单元格并绕过版本提交保存业务数据。
禁止 D3 图表读取 sheet cells。
允许在 Workbook Edit Mode 中修改受控字段、新增行、显式删除行。
Edit Mode 修改必须进入 Validation → Business Diff → Commit。
```

### 5.2 写入必须受控

所有写入走：

```text
Workbook Edit / Import / Controlled Form
→ Validation
→ Business Diff
→ Commit
→ Projection refresh
```

### 5.3 图表服务业务判断

图表不是装饰，必须支持：

```text
现金流判断
保函敞口判断
进度偏差判断
版本影响判断
```

### 5.4 版本上下文必须可见

用户必须随时知道当前视图来自：

```text
branch
commit
tag
scenario
asOfDate
currency
horizon
filter scope
```

## 6. MVP 范围

MVP 默认币种为 **EUR**。业务模型保留 currency 字段，后续可扩展多币种和手工 FX table；MVP 汇总视图、图表和导出默认以 EUR 展示。


MVP 应包含：

```text
1. 项目主数据模型
2. 节点收款模型
3. 进度快照模型
4. 保函模型
5. 现金流模型
6. IndexedDB 本地存储
7. JSON repo snapshot import/export
8. Excel `.xlsx` Full Master Data / Periodic Update 模板导入
9. Excel `.xlsx` workbook/report 导出，CSV 当前 sheet 导出作为辅助
10. 导入校验
11. Business diff 预览
12. Commit / branch / tag / revert
13. Glide Workbook View/Edit Mode：View Mode 默认，Edit Mode 支持字段修改、新增行、显式删除行
14. 表格内 micro chart
15. D3 cashflow bar + cumulative line
16. D3 guarantee stacked area
17. D3 guarantee expiry heatmap
18. D3 project progress scatter
19. EPC Control Timeline 只读视图
20. 视觉系统：Roboto / Lucide / shadcn / blue gradient
```

## 7. MVP 非目标

以下不进入 MVP：

```text
多人实时协作
正式审批流
后端用户认证
银行接口
ERP/CRM 自动同步
自动汇率接口
拖拽编辑 Gantt
复杂关键路径计算
复杂权限矩阵
Excel 公式引擎
通用在线 spreadsheet 编辑器 / 任意单元格与公式编辑
```

## 8. 核心视图

| 视图 | 功能 |
|---|---|
| Portfolio Dashboard | 组合级 KPI、现金流、保函敞口、风险 |
| Workbook | View/Edit 项目台账、节点、现金流、保函；diff、validation 和审计 sheet 始终只读 |
| EPC Control Timeline | 项目/阶段/节点/收款/保函时间线 |
| Cashflow Dashboard | 月度现金流、累计现金流、场景比较、逾期 |
| Guarantee Dashboard | 保函敞口、stacked area、到期热力图、银行额度 |
| Versions | commit、branch、tag、diff、revert |
| Import Center | 模板上传、校验、差异预览、commit |
| Settings | 用户、base currency `EUR`、FX rate 预留、业务规则、备份 |

## 9. 核心工作流

### 9.1 初始化项目数据

```text
下载 Full Master Data Template
在 Excel 中填写 Projects / Milestones / Guarantee Rules / Opening Balances
上传模板
系统校验
查看 diff
提交 commit
生成初始 tag
```

### 9.2 月度进度更新

```text
下载 Periodic Update Template
PM 填写 ProgressUpdates
财务填写 CashCollectionUpdates 和 GuaranteeUpdates
上传模板
系统校验
系统生成现金流和保函影响
查看 diff
提交 commit
刷新 dashboard
```

### 9.3 查看保函敞口

```text
进入 Guarantee Dashboard
选择 horizon
选择 stack mode: Project / PM / Location / Bank / Guarantee Type
查看 stacked area
hover 查看月份明细
点击项目进入详情
导出 guarantee exposure report
```

### 9.4 版本月结

```text
确认当前 branch working tree clean
查看本月 diff summary
提交最终 commit
创建 tag: 2026-05 Board / 2026-05 Closing
导出 repo snapshot 和 workbook report
```

## 10. 验收标准

MVP 验收至少满足：

```text
1. 可导入 20 个 EPC 项目的主数据和节点数据
2. 可生成 Project Register / Milestone / Cashflow / Guarantee workbook，并支持 View/Edit Mode 切换
3. 可根据 milestone 自动生成 cashflow forecast
4. 可根据 guarantee rule 自动生成 guarantee demand/exposure
5. 可展示多项目保函敞口 stacked area
6. 可展示月度现金流柱状图和累计曲线
7. 可导入 periodic update 并生成 validation errors
8. 可查看业务 diff 后提交 commit
9. 可在 Workbook Edit Mode 修改允许字段、新增行、显式删除行，并在 commit 前查看 validation 和 business diff
10. 可创建 branch / tag / revert
11. 可导出 JSON repo snapshot 并重新导入恢复数据
12. 可导入 Excel `.xlsx` Full Master Data / Periodic Update 模板
13. 可导出 Excel `.xlsx` workbook/report
14. 可导出 CSV 当前 sheet 作为辅助格式
15. 所有写入均有 commit 记录
```
