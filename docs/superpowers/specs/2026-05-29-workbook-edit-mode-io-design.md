# Workbook Edit Mode and JSON/Excel IO Design

Date: 2026-05-29
Status: Proposed for user review

## Context

The original EPC Control Console baseline defined the Glide Workbook as a read-only projection and IO surface. The updated product direction keeps View Mode as the default, but adds a controlled Edit Mode so users can modify operational data directly in the workbook when that is more efficient than preparing an external template.

The architectural guardrail remains unchanged: workbook cells are not the canonical fact source. Any workbook edit must become a staged business change, pass validation, produce a business diff, and be committed before it updates the repository.

## Decision

MVP will support a View/Edit toggle in the Glide Workbook.

View Mode supports analysis operations: filtering, sorting, copying, row selection, detail drawers, and export.

Edit Mode supports controlled business edits:

- Modify allowed fields on existing business rows.
- Add new rows for supported business entities.
- Mark supported rows for explicit deletion.
- Save changes into a staging transaction.
- Validate, preview business diff, require a commit message, then commit.

Validation Errors, Version Diff, Commit History, Tags, Branches, and system/audit sheets remain read-only in all modes.

## Editable Scope

MVP editable sheets:

- Project Register: create and update projects.
- Project Phases: create, update, and explicitly delete phases.
- Milestone Receivable Plan: create, update, and explicitly delete milestones.
- Guarantee Register: create, update, and explicitly delete guarantees.
- Cashflow Forecast: create manual adjustments, update editable forecast/status fields, and explicitly delete manual adjustments.
- Progress Snapshot: create and update progress snapshots.

MVP non-editable rows or fields:

- System-generated cashflow items from milestones or guarantee fees.
- Source commit, generated IDs, createdAt, updatedAt, snapshot hashes, and audit fields.
- Validation Errors and Version Diff rows.
- Any row generated only for projection display and not mapped to a canonical entity.

## User Experience

The workbook toolbar includes a clear mode control:

```text
Mode: View | Edit
```

When entering Edit Mode:

- The top context bar changes working tree status to an edit-session state.
- Editable cells show an edit affordance.
- Non-editable cells remain locked and explain why on hover or attempted edit.
- Add row and Mark delete actions become available for supported sheets.

When leaving Edit Mode with unsaved edits:

- User can save to staging, discard edits, or cancel mode switch.
- Saving does not commit directly.

When a row is marked for deletion:

- The row remains visible with a deleted state.
- The deletion is reversible until commit.
- Commit creates a DELETE business diff.

## Data Flow

Workbook editing uses a dedicated edit session:

```text
Workbook projection
-> WorkbookEditSession
-> Field/row changes
-> Validation engine
-> StagingTransaction
-> BusinessDiff
-> Commit engine
-> Repository update
-> Projection refresh
```

The edit session stores only proposed changes and row operation metadata. It does not mutate IndexedDB repository stores until a commit succeeds.

Suggested model:

```ts
export type WorkbookMode = "VIEW" | "EDIT";

export type WorkbookEditOperation = "CREATE" | "UPDATE" | "DELETE";

export interface WorkbookEditSession {
  id: string;
  branch: string;
  baseCommitHash: string;
  sheetId: string;
  createdAt: string;
  updatedAt: string;
  status: "OPEN" | "VALIDATING" | "READY_TO_COMMIT" | "COMMITTED" | "DISCARDED";
  changes: WorkbookCellChange[];
  rowOperations: WorkbookRowOperation[];
}

export interface WorkbookCellChange {
  id: string;
  entityType: string;
  entityId?: string;
  entityCode?: string;
  field: string;
  oldValue?: unknown;
  newValue: unknown;
}

export interface WorkbookRowOperation {
  id: string;
  operation: WorkbookEditOperation;
  entityType: string;
  entityId?: string;
  entityCode?: string;
  draftRow?: Record<string, unknown>;
}
```

The existing staging transaction and version commit concepts remain the authoritative write path.

## Validation

Workbook edits use the same validation rules as imports wherever possible:

- Required fields must be present.
- Dates and money values must parse into canonical formats.
- Entity unique keys must remain unique.
- Foreign keys must resolve inside the active branch context.
- Currency defaults to EUR only where template or UI policy explicitly allows defaulting.
- Deletion must be explicit and shown as a DELETE diff.
- System-generated fields are locked.

Blocking errors prevent commit. Warnings can be committed after review if the workflow allows non-blocking warnings.

## JSON and Excel IO

MVP must prioritize JSON and Excel compatibility.

Supported import:

- JSON repo snapshot for backup, restore, and repository migration.
- Excel `.xlsx` full master data template.
- Excel `.xlsx` periodic update template.
- CSV single-sheet import may remain as a lightweight adapter, but it is not the primary business workflow.

Supported export:

- JSON repo snapshot, including schemaVersion, settings, repository data, branches, tags, and commits.
- Excel full portfolio workbook/report from projection data.
- Excel current workbook sheet or selected report.
- CSV current sheet export may remain optional or secondary.

Export must read from canonical data, snapshots, or projections. It must not scrape DOM, canvas, or Glide cells.

## GitHub Pages Compatibility

The design remains compatible with GitHub Pages because all repository, staging, edit session, import/export, and versioning state is local to the browser through IndexedDB and file downloads/uploads.

No backend service is required for MVP.

## Documentation Updates Needed

The following documents should be revised after this design is accepted:

- `README.md`: replace read-only workbook baseline with View/Edit workbook baseline and JSON/Excel IO priority.
- `ref/epc-control-console-md/README.md`: update project positioning and decision table.
- `ref/epc-control-console-md/00_DECISION_ITEMS.md`: update D-001 and related workbook assumptions.
- `ref/epc-control-console-md/01_PRD_AND_SCOPE.md`: update goals, MVP scope, views, workflows, and acceptance criteria.
- `ref/epc-control-console-md/02_SYSTEM_ARCHITECTURE.md`: add WorkbookEditSession and edit-to-staging flow.
- `ref/epc-control-console-md/03_DOMAIN_DATA_MODEL.md`: add workbook mode/edit session models and change sheet readOnly typing.
- `ref/epc-control-console-md/04_IO_AND_IMPORT_EXPORT.md`: clarify JSON and Excel as primary IO formats.
- `ref/epc-control-console-md/05_VERSIONING_AND_AUDIT.md`: add workbook edit workflow as a controlled write path.
- `ref/epc-control-console-md/06_WORKBOOK_AND_GRID_SPEC.md`: replace read-only-only behavior with View/Edit Mode behavior.
- `ref/epc-control-console-md/10_DEVELOPMENT_HANDOFF.md`: update Phase 4 acceptance tests and risks.

## Testing Strategy

Acceptance tests should cover:

- Workbook opens in View Mode by default.
- Edit Mode allows updating an editable project field without directly mutating canonical data.
- Add row creates a staged CREATE diff.
- Mark delete creates a staged DELETE diff and can be undone before commit.
- Locked fields reject edits with a clear message.
- Validation blocks invalid edits before commit.
- Commit writes staged workbook edits and refreshes projections.
- JSON snapshot export/import preserves repository, commits, branches, tags, and settings.
- Excel template import/export handles full master data and periodic updates.

## Open Implementation Notes

Glide Data Grid remains the default workbook renderer. The editability contract should live in an adapter or sheet metadata layer so a future grid replacement does not affect domain write rules.

The product should avoid Excel-like formulas in MVP. Edit Mode is for structured business fields, not arbitrary spreadsheet computation.
