# 00. Decision Items

版本：Baseline 0.2  
日期：2026-05-29  
状态：关键产品与技术决策已锁定，可进入 MVP 开发。

本文件记录当前 EPC Control Console 的产品、架构、IO、版本管理、视觉和图表决策。2026-05-29 已确认：**默认币种为 EUR，其他事项均按默认建议执行**。当前无阻塞开发启动的待决策事项。

## 1. 已锁定的核心决策

| 编号 | 事项 | 当前决策 |
|---|---|---|
| D-001 | 表格层定位 | Excel-like View/Edit Workbook + IO 界面；默认 View Mode，Edit Mode 的单元格修改必须进入 staging、validation、diff、commit |
| D-002 | 主 Grid | Glide Data Grid |
| D-003 | Univer | 不作为 MVP 默认依赖，未来可做 adapter |
| D-004 | RevoGrid | Project/Gantt 示例可借鉴视觉与交互，不作为 MVP 主依赖 |
| D-005 | 组件库 | shadcn/ui |
| D-006 | 图标 | Lucide icons |
| D-007 | 字体 | Roboto，中文 fallback，hash/code 使用等宽字体 |
| D-008 | 主色 | `#1565C0` |
| D-009 | 浅色 | `#90CAF9` |
| D-010 | 主梯度 | `#1565C0 → #42A5F5 → #90CAF9` |
| D-011 | 图表库 | D3 |
| D-012 | 新增核心图 | D3 stacked area 展示多项目保函敞口 |
| D-013 | 数据事实源 | 结构化 domain model，不是 sheet cells |
| D-014 | 版本管理 | 应用内 Git-like 版本管理 |

## 2. 已锁定的 MVP 执行决策

| 编号 | 事项 | 当前决策 | 开发影响 |
|---|---|---|---|
| D-101 | MVP 是否严格纯前端 | 是。MVP 不建设后端 API | 使用 IndexedDB + JSON repo import/export；后续可迁移后端 |
| D-102 | 用户身份与权限 | MVP 不做正式鉴权；Settings 中设置 current user 作为 commit author | 不做 OAuth/SSO/权限矩阵 |
| D-103 | 多人协作 | MVP 不做实时协作 | 通过 repo snapshot、template、commit/tag 进行离线协作 |
| D-104 | 币种策略 | **默认 baseCurrency = EUR**；后续预留多币种和 FX table | Dashboard、图表、导出汇总默认显示 EUR |
| D-105 | 保函敞口主口径 | 默认显示 Issued Exposure；支持切换 Required Exposure / Fee Forecast | 主 KPI 和 stacked area 默认看已开立未释放敞口 |
| D-106 | 导入删除规则 | 不允许隐式删除；删除必须显式 `deleteFlag = TRUE` 或受控操作 | 防止模板缺行误删项目、节点或保函 |
| D-107 | Commit message | 强制填写 commit message | 所有写入必须形成可审计 commit |
| D-108 | 图表时间粒度 | Dashboard、现金流、保函主图默认按 month；Timeline 可 zoom 到 week | MVP 不做 day-level 高密度主图 |
| D-109 | Stacked area 项目数量 | 默认 Top 7 projects + Others | 避免 20 项目色彩和图例过载 |
| D-110 | spline 使用规则 | 月度现金流用 bar；累计现金流用 line；保函敞口默认 step/linear；smooth 仅作为选项 | 避免把节点/区间型财务事件误表现为连续流 |
| D-111 | 部署方式 | 静态站点部署 | 支持内部静态服务器、对象存储/CDN 或 Vercel/Netlify 类托管 |
| D-112 | 深色模式 | MVP 不做 dark mode，只保留 token 结构 | 优先支持浅色财务表格和截图场景 |
| D-113 | Workbook 编辑模式 | MVP 支持 View/Edit toggle；Edit Mode 可在允许的 sheet/row 上修改字段、新增行、显式删除行，但不得直接写入 canonical repository | Workbook 写入进入 WorkbookEditSession / StagingTransaction，再 validation、diff、commit |
| D-114 | JSON/Excel IO 优先级 | JSON repo snapshot 和 Excel `.xlsx` 模板/报表为主；CSV 为单表辅助格式 | GitHub Pages 静态部署下通过文件上传/下载完成备份、恢复和业务模板流转 |

## 3. 币种执行规则

MVP 执行口径：

```text
baseCurrency: EUR
currencyDisplay: EUR
fxRateSource: MANUAL / reserved
multiCurrency: reserved for future expansion
```

规则：

```text
1. 项目、现金流、保函模型仍保留 currency 字段。
2. MVP 导入模板默认要求 currency = EUR。
3. Dashboard、D3 图表、Workbook 汇总和导出默认使用 EUR。
4. 若后续导入非 EUR 项目，必须先提供手工 FX rate，再允许进入汇总视图。
5. MVP 不接入自动汇率接口。
```

## 4. 保函敞口口径

默认主口径：

```text
Issued Exposure = 已开立且未释放的保函金额
```

同时保留辅助口径：

```text
Required Exposure = 按节点规则预计需要的保函金额
Required but Not Issued = requiredAmount - issuedAmount，且 requiredDate 已到或即将到
Fee Forecast = 保函费用预测
```

图表默认：

```text
Guarantee Exposure Stacked Area 默认展示 Issued Exposure。
用户可切换 Required Exposure / Fee Forecast。
```

## 5. 导入删除规则

导入模板必须按唯一键匹配现有数据：

```text
Project: projectCode
Milestone: projectCode + milestoneCode
Guarantee: projectCode + guaranteeCode 或 projectCode + milestoneCode + guaranteeType
Cashflow: projectCode + milestoneCode + cashflowType 或 adjustmentCode
```

处理规则：

```text
匹配到现有对象 → update
未匹配到现有对象 → create
导入文件缺少某个已有对象 → 不处理，不删除
deleteFlag = TRUE → 进入 delete diff，等待用户确认 commit
```

## 6. 当前无待决策事项

开发团队可按本文件和其他规格文档进入 MVP 实施。若后续新增事项，应追加到本文件并记录：

```text
编号
提出日期
决策状态
备选方案
最终决策
影响范围
```
