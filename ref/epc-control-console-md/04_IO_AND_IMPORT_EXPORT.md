# 04. IO and Import/Export

版本：Baseline 0.2  
日期：2026-05-29

## 1. IO 原则

MVP 默认 `baseCurrency = EUR`。导入导出模板暂按 EUR 作为汇总和展示币种；模板中的 `currency` 字段应默认填入 `EUR`。后续如扩展多币种，必须启用手工 FX table 或自动 FX provider 后再进入组合级汇总视图。

```text
Workbook 是 IO 入口，不是编辑器。
用户可以下载模板、导入模板、导出视图。
导入不能直接覆盖数据，必须进入 staging。
导出来自 projection 或 domain snapshot，不从 DOM 抓取。
```

## 2. 支持文件类型

| 类型 | 用途 |
|---|---|
| XLSX | 标准业务模板，适合 PM/财务使用 |
| CSV | 单表快速导入导出 |
| JSON | repo snapshot、系统备份、版本库迁移 |
| ZIP | 可选，用于打包 JSON repo + attachments，MVP 可不做 |

## 2.1 MVP IO Defaults

```text
baseCurrency: EUR
project/cashflow/guarantee currency: default EUR if empty only when template policy allows defaulting
implicit delete: disabled
deleteFlag: required for delete diff
commit message: required
```

导入模板仍保留 `currency` 字段。MVP 中建议模板默认填充 `EUR`，后续多币种扩展时再启用 FX table 和跨币种汇总校验。

## 3. 模板类型

### 3.1 Full Master Data Template

用于初始化或大规模维护。

Sheets：

```text
Projects
ProjectPhases
Milestones
GuaranteeRules
OpeningGuarantees
OpeningCashflows
FxRates
Instructions
```

### 3.2 Periodic Update Template

用于每周/月更新。

Sheets：

```text
ProgressUpdates
GuaranteeUpdates
CashCollectionUpdates
ForecastAdjustments
Instructions
```

## 4. Full Master Data Template 字段

### 4.1 Projects

| Column | Required | Type | Description |
|---|---|---|---|
| projectCode | Yes | string | 项目唯一编码 |
| projectName | Yes | string | 项目名称 |
| pm | Yes | string | 项目经理 |
| location | Yes | string | 地点/国家/区域 |
| content | Yes | string | EPC 内容分类 |
| capacityKWh | No | number | 容量 |
| customer | No | string | 客户 |
| contractAmount | Yes | number | 合同金额 |
| currency | Yes | string | 币种 |
| startDate | No | date | 开始日期 |
| plannedCOD | No | date | 计划 COD |
| forecastCOD | No | date | 预测 COD |
| actualCOD | No | date | 实际 COD |
| status | Yes | enum | 项目状态 |
| notes | No | string | 备注 |

### 4.2 ProjectPhases

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| phaseType | Yes | enum |
| phaseName | Yes | string |
| sequence | Yes | number |
| baselineStartDate | No | date |
| baselineEndDate | No | date |
| plannedStartDate | No | date |
| plannedEndDate | No | date |
| forecastStartDate | No | date |
| forecastEndDate | No | date |
| progressPct | No | number |
| status | Yes | enum |

### 4.3 Milestones

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| milestoneCode | Yes | string |
| milestoneName | Yes | string |
| sequence | Yes | number |
| phaseType | No | enum |
| progressTriggerPct | No | number |
| baselineDate | No | date |
| plannedDate | Yes | date |
| forecastDate | No | date |
| actualDate | No | date |
| paymentPct | No | number |
| paymentAmount | No | number |
| paymentTermsDays | No | number |
| requiresGuarantee | Yes | boolean |
| guaranteeType | No | enum |
| guaranteeAmount | No | number |
| guaranteePct | No | number |
| status | Yes | enum |
| notes | No | string |
| deleteFlag | No | boolean |

### 4.4 OpeningGuarantees

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| milestoneCode | No | string |
| guaranteeCode | Yes | string |
| guaranteeType | Yes | enum |
| requiredAmount | Yes | number |
| issuedAmount | No | number |
| currency | Yes | string |
| bank | No | string |
| feeRate | No | number |
| requiredDate | Yes | date |
| issueDate | No | date |
| expiryDate | No | date |
| releaseDate | No | date |
| status | Yes | enum |
| releaseCondition | No | string |
| notes | No | string |
| deleteFlag | No | boolean |

### 4.5 OpeningCashflows

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| milestoneCode | No | string |
| cashflowCode | No | string |
| type | Yes | INFLOW/OUTFLOW |
| source | Yes | enum |
| plannedDate | Yes | date |
| forecastDate | Yes | date |
| invoiceDate | No | date |
| actualDate | No | date |
| amount | Yes | number |
| currency | Yes | string |
| probability | No | number |
| status | Yes | enum |
| scenarioCode | Yes | string |
| notes | No | string |
| deleteFlag | No | boolean |

## 5. Periodic Update Template 字段

### 5.1 ProgressUpdates

| Column | Required | Type |
|---|---|---|
| asOfDate | Yes | date |
| projectCode | Yes | string |
| engineeringPct | No | number |
| procurementPct | No | number |
| constructionPct | No | number |
| commissioningPct | No | number |
| overallPct | Yes | number |
| updatedBy | No | string |
| comment | No | string |

### 5.2 GuaranteeUpdates

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| milestoneCode | No | string |
| guaranteeCode | Yes | string |
| guaranteeType | Yes | enum |
| requiredAmount | No | number |
| issuedAmount | No | number |
| bank | No | string |
| feeRate | No | number |
| requiredDate | No | date |
| issueDate | No | date |
| expiryDate | No | date |
| releaseDate | No | date |
| status | Yes | enum |
| notes | No | string |
| deleteFlag | No | boolean |

### 5.3 CashCollectionUpdates

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| milestoneCode | Yes | string |
| invoiceDate | No | date |
| receivedDate | No | date |
| receivedAmount | No | number |
| status | Yes | enum |
| notes | No | string |

### 5.4 ForecastAdjustments

| Column | Required | Type |
|---|---|---|
| projectCode | Yes | string |
| milestoneCode | No | string |
| adjustmentCode | No | string |
| type | Yes | INFLOW/OUTFLOW |
| forecastDate | Yes | date |
| amount | Yes | number |
| currency | Yes | string |
| probability | No | number |
| scenarioCode | Yes | string |
| reason | Yes | string |
| deleteFlag | No | boolean |

## 6. 导入流程

```text
1. 用户选择文件
2. File Adapter 解析 workbook/csv/json
3. 检查 sheet 名称和列名
4. Schema Mapper 映射到 ImportBatch
5. 基础类型校验
6. 外键校验：projectCode / milestoneCode / scenarioCode
7. 业务规则校验
8. 生成 StagingTransaction
9. 显示 Validation Errors / Warnings
10. 若无 blocking errors，生成 Business Diff
11. 用户输入 commit message
12. Commit Engine 写入 repository
13. Projection Engine 刷新所有视图
```

## 7. 导入冲突处理

默认规则：

```text
Project: projectCode 匹配
Milestone: projectCode + milestoneCode 匹配
Guarantee: projectCode + guaranteeCode 匹配
ProgressSnapshot: projectCode + asOfDate 匹配
CashCollection: projectCode + milestoneCode 匹配对应 cashflow
```

操作规则：

```text
匹配到现有实体 → UPDATE
未匹配到实体 → CREATE
deleteFlag = TRUE → DELETE
文件中缺失的实体 → 不变
```

## 8. 校验规则

### 8.1 Blocking Errors

```text
缺少必填字段
日期格式非法
金额不是数字
projectCode 不存在
milestoneCode 在项目内不存在
paymentPct 合计超过 100%，且未 override
保函到期日早于开立日
保函释放日早于开立日
status 不在枚举范围
currency 为空或非法；MVP 模板默认值为 EUR，但正式导入仍应校验字段存在
```

### 8.2 Warnings

```text
kWh 为空
PM 为空或不在历史列表中
requiredDate 已到但未开立保函
forecastDate 比 baselineDate 延后超过阈值
receivedAmount 与 milestone paymentAmount 不一致
cashflow probability 为空，默认 1
bank 为空，无法计算银行额度占用
```

## 9. Validation Errors Sheet

导入后在 Workbook 中生成只读 sheet：

| Column | Description |
|---|---|
| level | ERROR / WARNING / INFO |
| sourceSheet | 来源 sheet |
| rowNumber | 行号 |
| entityType | 实体类型 |
| entityCode | 实体编码 |
| field | 字段 |
| message | 错误信息 |
| suggestedFix | 建议修复 |

## 10. Business Diff Sheet

导入后生成只读 diff sheet：

| Column | Description |
|---|---|
| operation | CREATE / UPDATE / DELETE |
| entityType | 实体类型 |
| entityCode | 实体编码 |
| field | 字段 |
| oldValue | 原值 |
| newValue | 新值 |
| cashflowImpact | 现金流影响 |
| guaranteeImpact | 保函影响 |
| description | 业务描述 |

## 11. 导出类型

| Export | 内容 |
|---|---|
| Export Current View | 当前 Workbook sheet 筛选后的投影 |
| Export Full Portfolio Workbook | 全量只读 workbook |
| Export Cashflow Forecast | 现金流预测表 |
| Export Guarantee Register | 保函登记表 |
| Export Guarantee Exposure | 保函敞口明细和汇总 |
| Export Version Diff | 版本差异表 |
| Export Repo Snapshot | JSON 版本库快照 |

## 12. Repo Snapshot 格式

```json
{
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-05-29T12:00:00.000Z",
  "exportedBy": "user@example.com",
  "repository": {
    "projects": [],
    "projectPhases": [],
    "milestones": [],
    "progressSnapshots": [],
    "guarantees": [],
    "cashflowItems": [],
    "scenarios": [],
    "fxRates": [],
    "commits": [],
    "branches": [],
    "tags": []
  },
  "settings": {
    "baseCurrency": "EUR",
    "currentUser": {
      "name": "Local User",
      "email": "user@example.com"
    }
  }
}
```

MVP 默认仓库设置中 `baseCurrency` 必须初始化为 `EUR`。后续如启用多币种项目，FX rate 通过导入模板或 Settings 手工维护。

## 13. 导出文件命名

建议命名规则：

```text
epc-portfolio-{branch}-{commitShort}-{date}.xlsx
epc-cashflow-{scenario}-{horizon}-{date}.xlsx
epc-guarantee-exposure-{stackMode}-{date}.xlsx
epc-repo-snapshot-{tagOrCommit}-{date}.json
```

示例：

```text
epc-portfolio-base-a13f29-2026-05-29.xlsx
epc-guarantee-exposure-project-2026-05-29.xlsx
epc-repo-snapshot-2026-05-board-2026-05-29.json
```
