# EPC Control Console

Baseline workspace and runnable MVP for the EPC Control Console.

## Runnable MVP

The current MVP is a strictly frontend, static-deployable web app for managing EPC portfolio control data:

- React + TypeScript + Vite
- Deterministic 20-project in-memory repository
- JSON repo snapshot import/export
- Excel `.xlsx` workbook import/export through lazy-loaded ExcelJS
- Git-like in-app commit, branch, tag, validation, and business diff
- Workbook with View/Edit Mode toggle, controlled Project Register edits, row create, and explicit row delete
- Dashboard, cashflow, guarantee, timeline, versions, import center, and settings views
- Lucide icons, Roboto/Noto fallback stack, and `#1565C0` visual system

Core decisions from the reference docs:

- Base currency is `EUR`.
- Workbook/grid defaults to View Mode and can switch to controlled Edit Mode.
- Workbook cells are not the source of truth; canonical domain data is the only business fact source.
- Workbook edits, imports, and controlled forms all write through Validation -> Business Diff -> Commit.
- Import delete must be explicit with `deleteFlag = TRUE`.
- Default guarantee exposure metric is Issued Exposure, with Required Exposure and Fee Forecast toggles.

## Local Development

```bash
npm install
npm run dev
npm test
npm run build
npm audit
```

The Vite app is served at:

```text
http://localhost:5173/baseline/
```

The build output is written to `dist/`.

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

The MVP is configured for GitHub Pages by keeping the app as a static Vite build with base path `/baseline/`.

The Pages workflow publishes the built `dist/` artifact to the `gh-pages` branch. In repository settings, set Pages to deploy from:

```text
Branch: gh-pages
Folder: / (root)
```

CI and Pages workflows live in:

```text
.github/workflows/ci.yml
.github/workflows/pages.yml
```

The target Pages URL is:

```text
https://6234456.github.io/baseline/
```
