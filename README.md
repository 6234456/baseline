# EPC Control Console

Baseline workspace for the EPC Control Console MVP.

## Product Baseline

The MVP is a strictly frontend, static-deployable web app for managing EPC portfolio control data:

- React + TypeScript + Vite
- IndexedDB local repository
- JSON repo snapshot import/export
- XLSX/CSV template import/export
- Git-like in-app commit, branch, tag, diff, and revert
- Read-only Glide workbook
- D3 dashboards and EPC control timeline
- shadcn/ui, Lucide icons, Roboto, and `#1565C0` visual system

Core decisions from the reference docs:

- Base currency is `EUR`.
- Workbook/grid is a read-only projection and IO surface, not the source of truth.
- Canonical domain data is the only business fact source.
- All writes go through Import / Controlled Form -> Validation -> Business Diff -> Commit.
- Import delete must be explicit with `deleteFlag = TRUE`.
- Default guarantee exposure metric is Issued Exposure, with Required Exposure and Fee Forecast toggles.

## Reference Docs

The product, architecture, data model, IO, versioning, workbook, chart, timeline, and handoff specs are in:

```text
ref/epc-control-console-md/
```

Recommended reading order:

```text
00_DECISION_ITEMS.md
01_PRD_AND_SCOPE.md
02_SYSTEM_ARCHITECTURE.md
03_DOMAIN_DATA_MODEL.md
04_IO_AND_IMPORT_EXPORT.md
05_VERSIONING_AND_AUDIT.md
06_WORKBOOK_AND_GRID_SPEC.md
08_D3_CHART_SPEC.md
10_DEVELOPMENT_HANDOFF.md
```

## GitHub Pages Direction

The MVP should remain compatible with GitHub Pages by keeping the app as a static Vite build.

When the frontend is scaffolded, use:

```text
npm run build
```

and publish the generated `dist/` directory through GitHub Pages or a GitHub Actions deployment workflow.
