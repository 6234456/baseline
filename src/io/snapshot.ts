import type { EpcRepository } from "../domain/types";

export interface RepoSnapshot {
  schemaVersion: "1.0.0";
  exportedAt: string;
  exportedBy: string;
  repository: Omit<EpcRepository, "settings">;
  settings: EpcRepository["settings"];
}

export function exportRepoSnapshot(repository: EpcRepository, exportedBy: string) {
  const snapshot: RepoSnapshot = {
    schemaVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    exportedBy,
    repository: {
      projects: repository.projects,
      projectPhases: repository.projectPhases,
      milestones: repository.milestones,
      progressSnapshots: repository.progressSnapshots,
      guarantees: repository.guarantees,
      cashflowItems: repository.cashflowItems,
      scenarios: repository.scenarios,
      commits: repository.commits,
      branches: repository.branches,
      tags: repository.tags
    },
    settings: repository.settings
  };
  return JSON.stringify(snapshot, null, 2);
}

export function importRepoSnapshot(json: string): EpcRepository {
  const snapshot = JSON.parse(json) as RepoSnapshot;
  if (snapshot.schemaVersion !== "1.0.0") {
    throw new Error(`Unsupported snapshot schema version: ${snapshot.schemaVersion}`);
  }
  return {
    ...snapshot.repository,
    settings: snapshot.settings
  };
}
