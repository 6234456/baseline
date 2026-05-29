import type {
  AppSettings,
  Branch,
  CashflowItem,
  EpcRepository,
  Guarantee,
  Milestone,
  ProgressSnapshot,
  Project,
  ProjectPhase,
  Scenario,
  VersionCommit,
  VersionTag
} from "./types";

const now = "2026-05-29T08:00:00.000Z";
const pms = ["Alice Chen", "Bruno Keller", "Clara Novak", "Daniel Weber", "Eva Martin"];
const locations = ["Germany", "Spain", "Italy", "Poland", "France", "Netherlands"];
const contents = ["Solar + BESS", "Wind Balance", "Hydrogen EPC", "Substation", "Grid Storage"];
const banks = ["Deutsche Bank", "ING", "BNP Paribas", "Santander", "UniCredit"];

function id(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function isoMonth(baseMonth: number, offset: number, day = 15) {
  const date = new Date(Date.UTC(2026, baseMonth + offset, day));
  return date.toISOString().slice(0, 10);
}

function makeCommit(): VersionCommit {
  return {
    id: "commit-initial",
    hash: "a13f29b",
    parentHashes: [],
    branch: "base",
    message: "Initial 20 project seed portfolio",
    author: "Local User",
    createdAt: now,
    updatedAt: now,
    snapshotHash: "seed-snapshot-v1",
    diffSummary: {
      projectsChanged: 20,
      milestonesChanged: 80,
      guaranteesChanged: 40,
      cashflowItemsChanged: 80,
      cashflowImpactNext90Days: 4_650_000,
      guaranteeImpactNext60Days: 1_220_000,
      overdueReceivableDelta: 320_000,
      currency: "EUR"
    },
    changedEntityIds: []
  };
}

export function createSeedRepository(): EpcRepository {
  const commit = makeCommit();
  const projects: Project[] = [];
  const projectPhases: ProjectPhase[] = [];
  const milestones: Milestone[] = [];
  const guarantees: Guarantee[] = [];
  const cashflowItems: CashflowItem[] = [];
  const progressSnapshots: ProgressSnapshot[] = [];

  for (let i = 1; i <= 20; i += 1) {
    const projectId = id("project", i);
    const contractAmount = 2_400_000 + i * 335_000;
    const progress = Math.min(94, 18 + i * 3);
    const project: Project = {
      id: projectId,
      code: `EPC-${String(i).padStart(3, "0")}`,
      name: `${locations[i % locations.length]} ${contents[i % contents.length]} ${i}`,
      pm: pms[i % pms.length],
      location: locations[i % locations.length],
      content: contents[i % contents.length],
      capacityKWh: 8_000 + i * 1_250,
      customer: `Customer ${String.fromCharCode(64 + ((i % 20) || 20))}`,
      contractAmount,
      currency: "EUR",
      startDate: isoMonth(0, i % 4, 3),
      plannedCOD: isoMonth(5, i % 10, 20),
      forecastCOD: isoMonth(6, i % 11, 20),
      actualCOD: i < 4 ? isoMonth(4, i, 20) : undefined,
      status: i < 3 ? "COMPLETED" : i < 7 ? "COMMISSIONING" : i < 13 ? "CONSTRUCTION" : "ENGINEERING",
      createdAt: now,
      updatedAt: now,
      sourceCommitId: commit.hash
    };
    projects.push(project);

    const phaseTypes: ProjectPhase["phaseType"][] = [
      "ENGINEERING",
      "PROCUREMENT",
      "CONSTRUCTION",
      "COMMISSIONING"
    ];
    phaseTypes.forEach((phaseType, phaseIndex) => {
      projectPhases.push({
        id: `${projectId}-phase-${phaseIndex + 1}`,
        projectId,
        phaseType,
        name: `${phaseType[0]}${phaseType.slice(1).toLowerCase()}`,
        sequence: phaseIndex + 1,
        baselineStartDate: isoMonth(0, i + phaseIndex * 2, 1),
        baselineEndDate: isoMonth(1, i + phaseIndex * 2, 24),
        forecastStartDate: isoMonth(0, i + phaseIndex * 2 + (i % 3 === 0 ? 1 : 0), 1),
        forecastEndDate: isoMonth(1, i + phaseIndex * 2 + (i % 3 === 0 ? 1 : 0), 24),
        progressPct: Math.max(0, Math.min(100, progress - phaseIndex * 18)),
        status: progress - phaseIndex * 18 > 90 ? "COMPLETED" : i % 4 === 0 ? "DELAYED" : "ON_TRACK",
        createdAt: now,
        updatedAt: now,
        sourceCommitId: commit.hash
      });
    });

    const milestoneDefs = [
      ["AP", "Advance Payment", 0.15, "ADVANCE_PAYMENT"],
      ["MC", "Mechanical Completion", 0.25, "PERFORMANCE"],
      ["PAC", "Provisional Acceptance", 0.4, "PERFORMANCE"],
      ["FAC", "Final Acceptance", 0.2, "WARRANTY"]
    ] as const;
    milestoneDefs.forEach(([code, name, pct, guaranteeType], milestoneIndex) => {
      const milestoneId = `${projectId}-milestone-${code}`;
      const paymentAmount = Math.round(contractAmount * pct);
      const forecastDate = isoMonth(4, i + milestoneIndex * 2, 10 + milestoneIndex);
      milestones.push({
        id: milestoneId,
        projectId,
        code,
        sequence: milestoneIndex + 1,
        name,
        phaseType: phaseTypes[Math.min(milestoneIndex, phaseTypes.length - 1)],
        plannedDate: isoMonth(3, i + milestoneIndex * 2, 10 + milestoneIndex),
        forecastDate,
        paymentPct: pct,
        paymentAmount,
        paymentTermsDays: 30,
        requiresGuarantee: milestoneIndex < 2,
        guaranteeType,
        status: milestoneIndex === 0 && i < 8 ? "PAID" : i % 5 === 0 ? "DELAYED" : "PLANNED",
        createdAt: now,
        updatedAt: now,
        sourceCommitId: commit.hash
      });
      cashflowItems.push({
        id: `${projectId}-cashflow-${code}`,
        projectId,
        milestoneId,
        type: "INFLOW",
        source: "AUTO_FROM_MILESTONE",
        plannedDate: isoMonth(3, i + milestoneIndex * 2, 10 + milestoneIndex),
        forecastDate,
        invoiceDate: milestoneIndex === 0 && i < 8 ? isoMonth(3, i + milestoneIndex * 2, 16) : undefined,
        actualDate: milestoneIndex === 0 && i < 6 ? isoMonth(4, i + milestoneIndex * 2, 12) : undefined,
        amount: paymentAmount,
        currency: "EUR",
        probability: milestoneIndex < 2 ? 0.95 : 0.82,
        status: milestoneIndex === 0 && i < 6 ? "RECEIVED" : i % 6 === 0 ? "OVERDUE" : "PLANNED",
        scenarioId: "base",
        createdAt: now,
        updatedAt: now,
        sourceCommitId: commit.hash
      });
    });

    ["ADVANCE_PAYMENT", "PERFORMANCE"].forEach((type, guaranteeIndex) => {
      const guaranteeId = `${projectId}-guarantee-${guaranteeIndex + 1}`;
      guarantees.push({
        id: guaranteeId,
        projectId,
        milestoneId: `${projectId}-milestone-${guaranteeIndex === 0 ? "AP" : "MC"}`,
        code: `${project.code}-${guaranteeIndex === 0 ? "APB" : "PB"}`,
        type: type as Guarantee["type"],
        requiredAmount: Math.round(contractAmount * (guaranteeIndex === 0 ? 0.15 : 0.1)),
        issuedAmount: i % 4 === 0 ? 0 : Math.round(contractAmount * (guaranteeIndex === 0 ? 0.15 : 0.1)),
        currency: "EUR",
        bank: banks[(i + guaranteeIndex) % banks.length],
        feeRate: 0.012 + guaranteeIndex * 0.004,
        requiredDate: isoMonth(3, i + guaranteeIndex, 1),
        issueDate: i % 4 === 0 ? undefined : isoMonth(3, i + guaranteeIndex, 5),
        expiryDate: isoMonth(10, i + guaranteeIndex * 2, 28),
        releaseDate: i < 3 ? isoMonth(7, i + guaranteeIndex * 2, 28) : undefined,
        status: i % 4 === 0 ? "REQUIRED" : i < 3 ? "RELEASED" : "ISSUED",
        createdAt: now,
        updatedAt: now,
        sourceCommitId: commit.hash
      });
    });

    progressSnapshots.push({
      id: `${projectId}-progress-2026-05-29`,
      projectId,
      asOfDate: "2026-05-29",
      engineeringPct: Math.min(100, progress + 20),
      procurementPct: Math.min(100, progress + 8),
      constructionPct: Math.max(0, progress - 18),
      commissioningPct: Math.max(0, progress - 42),
      overallPct: progress,
      updatedBy: project.pm,
      comment: i % 5 === 0 ? "Forecast shifted by latest site update" : "On monthly reporting cadence",
      createdAt: now,
      updatedAt: now,
      sourceCommitId: commit.hash
    });
  }

  const scenarios: Scenario[] = [
    {
      id: "scenario-base",
      code: "base",
      name: "Base",
      isDefault: true,
      assumptions: {},
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scenario-conservative",
      code: "conservative",
      name: "Conservative",
      assumptions: { paymentDelayDays: 30, collectionProbabilityMultiplier: 0.85 },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scenario-optimistic",
      code: "optimistic",
      name: "Optimistic",
      assumptions: { paymentDelayDays: -15, collectionProbabilityMultiplier: 1.05 },
      createdAt: now,
      updatedAt: now
    }
  ];

  const settings: AppSettings = {
    id: "settings",
    baseCurrency: "EUR",
    currentUser: { name: "Local User", email: "user@example.com" },
    defaultScenarioCode: "base",
    defaultGuaranteeExposureMetric: "ISSUED_EXPOSURE",
    chartDefaults: { horizonMonths: 12, timeGrain: "MONTH", guaranteeStackMode: "PROJECT" },
    createdAt: now,
    updatedAt: now
  };

  const branch: Branch = {
    id: "branch-base",
    name: "base",
    headCommitHash: commit.hash,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };

  const tag: VersionTag = {
    id: "tag-board",
    name: "2026-05-board",
    commitHash: commit.hash,
    tagType: "BOARD_PACK",
    createdBy: "Local User",
    createdAt: now,
    updatedAt: now
  };

  commit.changedEntityIds = projects.map((project) => project.id);

  return {
    projects,
    projectPhases,
    milestones,
    progressSnapshots,
    guarantees,
    cashflowItems,
    scenarios,
    commits: [commit],
    branches: [branch],
    tags: [tag],
    settings
  };
}
