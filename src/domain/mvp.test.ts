import { describe, expect, it } from "vitest";
import { buildDashboardProjection, buildGuaranteeExposure, buildWorkbookProjection } from "./projections";
import {
  commitStagingTransaction,
  createWorkbookEditSession,
  stageWorkbookEditSession
} from "./workbookEdit";
import { createSeedRepository } from "./seed";
import { importRepoSnapshot, exportRepoSnapshot } from "../io/snapshot";
import { exportWorkbookXlsx, importWorkbookXlsx, parseWorkbookSheetNames } from "../io/excel";

describe("EPC Control Console MVP domain", () => {
  it("seeds a 20 project portfolio with EUR settings and version metadata", () => {
    const repository = createSeedRepository();

    expect(repository.projects).toHaveLength(20);
    expect(repository.settings.baseCurrency).toBe("EUR");
    expect(repository.branches[0]).toMatchObject({ name: "base", isDefault: true });
    expect(repository.commits[0].message).toContain("Initial");
  });

  it("stages workbook edits without mutating canonical data before commit", () => {
    const repository = createSeedRepository();
    const originalName = repository.projects[0].name;

    const session = createWorkbookEditSession(repository, "project-register");
    session.changes.push({
      id: "change-1",
      entityType: "PROJECT",
      entityId: repository.projects[0].id,
      entityCode: repository.projects[0].code,
      field: "name",
      oldValue: originalName,
      newValue: "Updated Solar EPC Portfolio"
    });

    const staged = stageWorkbookEditSession(repository, session);

    expect(repository.projects[0].name).toBe(originalName);
    expect(staged.validationIssues).toHaveLength(0);
    expect(staged.diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "UPDATE",
          entityType: "PROJECT",
          field: "name",
          oldValue: originalName,
          newValue: "Updated Solar EPC Portfolio"
        })
      ])
    );

    const committed = commitStagingTransaction(repository, staged, {
      author: "Local User",
      message: "Update project name from workbook"
    });

    expect(committed.repository.projects[0].name).toBe("Updated Solar EPC Portfolio");
    expect(committed.commit.message).toBe("Update project name from workbook");
    expect(committed.repository.branches[0].headCommitHash).toBe(committed.commit.hash);
  });

  it("commits controlled project row create and delete operations", () => {
    const repository = createSeedRepository();
    const session = createWorkbookEditSession(repository, "project-register");
    const now = "2026-05-29T08:30:00.000Z";

    session.rowOperations.push({
      id: "create-project",
      operation: "CREATE",
      entityType: "PROJECT",
      entityCode: "EPC-999",
      draftRow: {
        id: "project-999",
        code: "EPC-999",
        name: "New Controlled Workbook Project",
        pm: "Local User",
        location: "Germany",
        content: "Solar + BESS",
        capacityKWh: 10_000,
        customer: "Demo Customer",
        contractAmount: 1_250_000,
        currency: "EUR",
        startDate: "2026-06-01",
        plannedCOD: "2026-12-15",
        forecastCOD: "2027-01-15",
        status: "SIGNED",
        createdAt: now,
        updatedAt: now
      }
    });
    session.rowOperations.push({
      id: "delete-project",
      operation: "DELETE",
      entityType: "PROJECT",
      entityId: repository.projects[1].id,
      entityCode: repository.projects[1].code
    });

    const staged = stageWorkbookEditSession(repository, session);
    expect(staged.status).toBe("READY_TO_COMMIT");

    const committed = commitStagingTransaction(repository, staged, {
      author: "Local User",
      message: "Create and delete project rows from workbook"
    });

    expect(committed.repository.projects.some((project) => project.code === "EPC-999")).toBe(true);
    expect(committed.repository.projects.some((project) => project.id === repository.projects[1].id)).toBe(false);
  });

  it("builds dashboard projections for cashflow and guarantee exposure", () => {
    const repository = createSeedRepository();
    const dashboard = buildDashboardProjection(repository);
    const exposure = buildGuaranteeExposure(repository, {
      horizonMonths: 12,
      stackMode: "PROJECT",
      valueMode: "ISSUED_EXPOSURE"
    });

    expect(dashboard.kpis.totalContractValue).toBeGreaterThan(0);
    expect(dashboard.cashflow).toHaveLength(12);
    expect(exposure.months).toHaveLength(12);
    expect(exposure.series.length).toBeGreaterThan(1);
    expect(exposure.series.at(-1)?.key).toBe("Others");
  });

  it("projects guarantee bank interest fields into the workbook", () => {
    const repository = createSeedRepository();
    const workbook = buildWorkbookProjection(repository);
    const guaranteeSheet = workbook.sheets.find((sheet) => sheet.sheetId === "guarantee-register");
    const firstGuarantee = repository.guarantees[0];
    const firstRow = guaranteeSheet?.rows.find((row) => row.id === firstGuarantee.id);

    expect(guaranteeSheet?.columns.map((column) => column.title)).toEqual(
      expect.arrayContaining(["Fee Rate", "Annual Interest"])
    );
    expect(firstRow?.annualInterest).toBe(Math.round(firstGuarantee.issuedAmount * firstGuarantee.feeRate));
  });

  it("round-trips repository snapshots through JSON", () => {
    const repository = createSeedRepository();
    const json = exportRepoSnapshot(repository, "Local User");
    const restored = importRepoSnapshot(json);

    expect(restored.projects).toHaveLength(repository.projects.length);
    expect(restored.commits).toHaveLength(repository.commits.length);
    expect(restored.settings.baseCurrency).toBe("EUR");
  });

  it("round-trips an Excel workbook with MVP sheets", async () => {
    const repository = createSeedRepository();
    const buffer = await exportWorkbookXlsx(repository);
    const sheetNames = await parseWorkbookSheetNames(buffer);

    expect(sheetNames).toEqual(
      expect.arrayContaining([
        "Portfolio Summary",
        "Project Register",
        "Project Phases",
        "Milestone Plan",
        "Guarantee Register",
        "Cashflow Forecast",
        "Progress Snapshot",
        "Validation Errors"
      ])
    );
    expect(sheetNames).not.toContain("Version Diff");

    const restored = await importWorkbookXlsx(buffer);
    expect(restored.projects).toHaveLength(repository.projects.length);
    expect(restored.guarantees).toHaveLength(repository.guarantees.length);
    expect((restored.guarantees[0] as { annualInterest?: number }).annualInterest).toBe(
      Math.round(repository.guarantees[0].issuedAmount * repository.guarantees[0].feeRate)
    );
    expect(restored.settings.baseCurrency).toBe("EUR");
  });
});
