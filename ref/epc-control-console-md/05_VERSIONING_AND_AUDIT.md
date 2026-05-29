# 05. Versioning and Audit

版本：Baseline 0.2  
日期：2026-05-29

## 1. 目标

实现应用内 Git-like 版本管理，用于：

```text
追踪每次数据变化
支持月结版本
支持场景分支
支持 diff / revert / tag
支持审计某个字段的修改来源
```

MVP 不要求真实 Git 仓库，但版本概念要接近 GitHub 工作流。

## 2. 核心概念映射

| Git 概念 | 本系统概念 |
|---|---|
| Repository | EPC portfolio 数据仓库 |
| Working Tree | 当前导入/受控操作后的未提交数据 |
| Staging | 已校验、准备提交的数据 |
| Commit | 一次正式业务数据版本 |
| Branch | 不同预测口径或工作线 |
| Tag | 月结版、董事会版、正式预测版 |
| Diff | 业务语义差异 |
| Revert | 回滚某次提交 |
| Blame | 查看字段修改来源 |

## 3. 工作流

```text
Workbook Edit、文件导入或受控操作
→ Validation
→ StagingTransaction
→ BusinessDiff
→ 用户确认并填写 commit message
→ Commit
→ 更新 branch head
→ 刷新 projection
```

## 4. Branch 策略

默认 branch：

```text
base
```

推荐业务 branch：

```text
base
finance-forecast
pm-forecast
conservative
optimistic
board-pack-prep
```

规则：

```text
1. branch 从某个 commit 创建
2. branch head 指向最新 commit
3. 切换 branch 会刷新所有 projection
4. 不同 branch 可以拥有不同 scenario assumptions
5. tag 固定到 commit，不随 branch 变化
```

## 5. Commit 要求

每次 commit 必须包含：

```text
commit hash
parent hashes
branch
message
author
createdAt
snapshotHash
diffSummary
changedEntityIds
```

Commit message 强制填写。

推荐格式：

```text
Update May 2026 progress and guarantee status
Adjust conservative cashflow forecast for EPC-003 and EPC-011
Create board pack snapshot for 2026-05
```

## 6. Snapshot 设计

每个 commit 对应一个 normalized snapshot hash。

Snapshot 需要：

```text
稳定排序
去除 transient UI state
保留 domain entities
保留 version objects
可通过 hash 判断内容是否变化
```

建议 snapshot 内容：

```text
projects
projectPhases
milestones
progressSnapshots
guarantees
cashflowItems
scenarios
fxRates
settings relevant to calculations
```

## 7. Business Diff

Diff 不应只显示技术字段变化，应显示业务语义。

示例：

```text
Project: EPC-003
Milestone: PAC
Forecast Date: 2026-08-15 → 2026-09-10
Cashflow Impact: EUR 1,200,000 shifted from Aug to Sep
Guarantee Required: EUR 300,000 → EUR 450,000
```

Diff 类型：

```text
CREATE_PROJECT
UPDATE_PROJECT_FIELD
CREATE_MILESTONE
UPDATE_MILESTONE_DATE
UPDATE_MILESTONE_PAYMENT
CREATE_GUARANTEE
UPDATE_GUARANTEE_STATUS
UPDATE_GUARANTEE_AMOUNT
CREATE_CASHFLOW
UPDATE_CASHFLOW_FORECAST_DATE
UPDATE_CASHFLOW_STATUS
DELETE_ENTITY
```

## 8. Diff Summary

每次 commit 自动生成摘要：

```ts
interface CommitDiffSummary {
  projectsChanged: number;
  milestonesChanged: number;
  guaranteesChanged: number;
  cashflowItemsChanged: number;
  cashflowImpactNext90Days: number;
  guaranteeImpactNext60Days: number;
  overdueReceivableDelta: number;
  currency: string;
}
```

UI 展示：

```text
Projects changed: 8
Milestones changed: 21
Guarantees changed: 6
Cashflow impact next 90 days: +1.25M EUR
New guarantee required next 60 days: +430k EUR
Overdue receivable delta: +120k EUR
```

## 9. Tag

Tag 用于固定正式版本。

推荐 tag 命名：

```text
2026-05-closing
2026-05-board
2026-q2-forecast
financing-pack-2026-06
```

Tag 类型：

```text
MONTH_END
BOARD_PACK
FORECAST
RELEASE
OTHER
```

规则：

```text
1. tag 指向 commit
2. tag 不可直接修改
3. 若要修正 tag 数据，从 tag commit 创建 branch，修正后创建新 tag
4. export 文件应包含 tag/commit 信息
```

## 10. Revert

Revert 策略：

```text
不直接删除历史 commit
创建新的 revert commit
revert commit 包含被回滚 commit hash
revert 后重新生成 projection
```

Revert UI：

```text
选择 commit
查看将要回滚的业务变化
生成 reverse diff
用户确认并填写 message
创建 revert commit
```

## 11. Blame / Field History

字段历史可基于 commit diff 查询。

示例：

```text
Entity: Guarantee EPC-003-PB-001
Field: expiryDate
Current: 2026-11-30
Last changed by: Alice
Commit: a13f29
Date: 2026-05-29
Old value: 2026-10-31
New value: 2026-11-30
```

## 12. Working Tree 状态

顶部 context bar 应显示：

```text
Working tree: clean
Working tree: staged changes
Working tree: validation errors
```

状态定义：

| 状态 | 说明 |
|---|---|
| clean | 当前 branch head 无未提交变化 |
| staged changes | 有 staging transaction 可提交 |
| validation errors | staging 存在 blocking errors |
| dirty | 有本地更改尚未形成 staging，MVP 可不暴露 |

## 13. 版本视图

Versions 页面应包含：

```text
Commit list
Commit detail
Branch list
Tag list
Diff viewer
Revert action
Create branch from commit/tag
Create tag from commit
Export snapshot from commit/tag
```

## 14. 审计约束

```text
1. 所有业务写入必须产生 commit
2. Commit 不可修改
3. Tag 不可修改
4. Revert 通过新 commit 实现
5. 导入文件名和导入时间必须记录
6. Commit author 必须记录
7. 已导出的 repo snapshot 必须包含 schemaVersion 和 commit/tag 信息
8. Workbook Edit Mode 在支持的 sheet/row 上产生的字段修改、新增行、显式删除行必须记录为 BusinessDiff
9. WorkbookEditSession 不可绕过 commit 写入 canonical repository
```
