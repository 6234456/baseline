import type {
  BusinessDiff,
  EpcRepository,
  Project,
  StagingTransaction,
  WorkbookEditSession
} from "./types";

const editableProjectFields = new Set<keyof Project>([
  "name",
  "pm",
  "location",
  "content",
  "capacityKWh",
  "customer",
  "contractAmount",
  "plannedCOD",
  "forecastCOD",
  "status",
  "notes"
]);

const requiredProjectFields = new Set(["id", "code", "name", "pm", "location", "contractAmount", "currency", "status"]);

function timestamp() {
  return new Date().toISOString();
}

function shortHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(7, "0").slice(0, 7);
}

function cloneRepository(repository: EpcRepository): EpcRepository {
  return structuredClone(repository) as EpcRepository;
}

export function createWorkbookEditSession(repository: EpcRepository, sheetId: string): WorkbookEditSession {
  const currentBranch = repository.branches.find((branch) => branch.isDefault) ?? repository.branches[0];
  const createdAt = timestamp();
  return {
    id: `edit-${createdAt}`,
    branch: currentBranch?.name ?? "base",
    baseCommitHash: currentBranch?.headCommitHash ?? repository.commits[0]?.hash ?? "none",
    sheetId,
    status: "OPEN",
    changes: [],
    rowOperations: [],
    validationIssues: [],
    diff: [],
    createdAt,
    updatedAt: createdAt
  };
}

export function stageWorkbookEditSession(repository: EpcRepository, session: WorkbookEditSession): StagingTransaction {
  const validationIssues = [];
  const diff: BusinessDiff[] = [];

  for (const change of session.changes) {
    if (change.entityType !== "PROJECT") {
      validationIssues.push({
        id: `issue-${change.id}`,
        level: "ERROR" as const,
        field: change.field,
        entityCode: change.entityCode,
        message: "MVP workbook edit demo currently applies direct cell changes to Project rows only.",
        suggestedFix: "Use supported Project Register fields or import a template."
      });
      continue;
    }

    if (!editableProjectFields.has(change.field as keyof Project)) {
      validationIssues.push({
        id: `issue-${change.id}`,
        level: "ERROR" as const,
        field: change.field,
        entityCode: change.entityCode,
        message: "This field is locked for workbook editing.",
        suggestedFix: "Edit an allowed business field or use controlled import."
      });
      continue;
    }

    diff.push({
      id: `diff-${change.id}`,
      operation: "UPDATE",
      entityType: "PROJECT",
      entityId: change.entityId,
      entityCode: change.entityCode,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      currency: repository.settings.baseCurrency,
      description: `${change.entityCode ?? "Project"} ${change.field}: ${String(change.oldValue)} -> ${String(change.newValue)}`
    });
  }

  for (const operation of session.rowOperations) {
    if (operation.entityType !== "PROJECT") {
      validationIssues.push({
        id: `issue-${operation.id}`,
        level: "ERROR" as const,
        entityCode: operation.entityCode,
        message: "MVP row operations currently support Project rows only.",
        suggestedFix: "Use Project Register row operations or import a supported workbook."
      });
      continue;
    }

    if (operation.operation === "CREATE") {
      const missingFields = [...requiredProjectFields].filter((field) => !operation.draftRow?.[field]);
      if (missingFields.length) {
        validationIssues.push({
          id: `issue-${operation.id}`,
          level: "ERROR" as const,
          entityCode: operation.entityCode,
          message: `New project row is missing required fields: ${missingFields.join(", ")}.`,
          suggestedFix: "Fill required Project Register columns before staging."
        });
        continue;
      }
    }

    if (operation.operation === "DELETE" && !operation.entityId) {
      validationIssues.push({
        id: `issue-${operation.id}`,
        level: "ERROR" as const,
        entityCode: operation.entityCode,
        message: "Delete operations must target an existing project row.",
        suggestedFix: "Select an existing Project Register row."
      });
      continue;
    }

    diff.push({
      id: `diff-${operation.id}`,
      operation: operation.operation,
      entityType: operation.entityType,
      entityId: operation.entityId,
      entityCode: operation.entityCode,
      newValue: operation.draftRow,
      currency: repository.settings.baseCurrency,
      description: `${operation.operation} ${operation.entityType} ${operation.entityCode ?? ""}`.trim()
    });
  }

  const createdAt = timestamp();
  return {
    id: `staging-${createdAt}`,
    baseCommitId: session.baseCommitHash,
    branch: session.branch,
    workbookEditSessionId: session.id,
    validationIssues,
    diff,
    status: validationIssues.some((issue) => issue.level === "ERROR") ? "INVALID" : "READY_TO_COMMIT",
    createdAt,
    updatedAt: createdAt
  };
}

export function commitStagingTransaction(
  repository: EpcRepository,
  transaction: StagingTransaction,
  options: { author: string; message: string }
) {
  if (!options.message.trim()) {
    throw new Error("Commit message is required.");
  }
  if (transaction.status !== "READY_TO_COMMIT") {
    throw new Error("Cannot commit a transaction with blocking validation errors.");
  }

  const next = cloneRepository(repository);
  const updatedAt = timestamp();

  for (const entry of transaction.diff) {
    if (entry.entityType === "PROJECT" && entry.operation === "UPDATE" && entry.entityId && entry.field) {
      const project = next.projects.find((candidate) => candidate.id === entry.entityId);
      if (project) {
        (project as unknown as Record<string, unknown>)[entry.field] = entry.newValue;
        project.updatedAt = updatedAt;
      }
    }

    if (entry.entityType === "PROJECT" && entry.operation === "CREATE" && entry.newValue) {
      const draft = entry.newValue as Project;
      next.projects = [
        {
          ...draft,
          createdAt: draft.createdAt ?? updatedAt,
          updatedAt,
          sourceCommitId: transaction.baseCommitId
        },
        ...next.projects
      ];
    }

    if (entry.entityType === "PROJECT" && entry.operation === "DELETE" && entry.entityId) {
      next.projects = next.projects.filter((candidate) => candidate.id !== entry.entityId);
    }
  }

  const hash = shortHash(`${transaction.id}-${options.message}-${updatedAt}-${JSON.stringify(transaction.diff)}`);
  const commit = {
    id: `commit-${hash}`,
    hash,
    parentHashes: [transaction.baseCommitId],
    branch: transaction.branch,
    message: options.message,
    author: options.author,
    snapshotHash: shortHash(JSON.stringify(next.projects) + updatedAt),
    diffSummary: {
      projectsChanged: new Set(transaction.diff.filter((entry) => entry.entityType === "PROJECT").map((entry) => entry.entityId)).size,
      milestonesChanged: transaction.diff.filter((entry) => entry.entityType === "MILESTONE").length,
      guaranteesChanged: transaction.diff.filter((entry) => entry.entityType === "GUARANTEE").length,
      cashflowItemsChanged: transaction.diff.filter((entry) => entry.entityType === "CASHFLOW_ITEM").length,
      cashflowImpactNext90Days: 0,
      guaranteeImpactNext60Days: 0,
      overdueReceivableDelta: 0,
      currency: "EUR" as const
    },
    changedEntityIds: transaction.diff.map((entry) => entry.entityId).filter((id): id is string => Boolean(id)),
    createdAt: updatedAt,
    updatedAt
  };

  next.commits = [commit, ...next.commits];
  next.branches = next.branches.map((branch) =>
    branch.name === transaction.branch ? { ...branch, headCommitHash: hash, updatedAt } : branch
  );

  return { repository: next, commit };
}
