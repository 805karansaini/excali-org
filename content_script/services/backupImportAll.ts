import JSZip from "jszip";
import type { AppSettings } from "../../shared/unified-db";
import { backupOperations, unifiedDb } from "../../shared/unified-db";
import type { ExcalidrawElement } from "../../shared/excalidraw-types";
import type { UnifiedCanvas, UnifiedProject } from "../../shared/types";

export type ImportMode = "merge" | "replace";

export interface ParsedBackupZip {
  canvases: UnifiedCanvas[];
  projects: UnifiedProject[];
  settings: AppSettings[];
}

export interface ConflictReport {
  canvasIds: string[];
  projectIds: string[];
  projectNames: string[];
  settingKeys: string[];
}

export interface ImportResult {
  mode: ImportMode;
  imported: { canvases: number; projects: number; settings: number };
  skipped: {
    canvases: Array<{ id: string; incomingName: string; existingName?: string }>;
    projectsById: Array<{ id: string; incomingName: string; existingName?: string }>;
    projectsByName: Array<{ id: string; name: string; existingId?: string }>;
    settings: Array<{ key: string }>;
  };
  warnings: {
    canvasesOrphanedFromProject: Array<{ id: string; name: string; projectId?: string }>;
  };
}

const parseDate = (value: unknown, label: string): Date => {
  const date =
    typeof value === "number"
      ? new Date(value)
      : new Date(typeof value === "string" ? value : String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${label}`);
  return date;
};

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object") throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
};

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const parseBackupZip = async (
  file: File,
  onProgress?: (message: string) => void,
): Promise<ParsedBackupZip> => {
  onProgress?.("Reading zip…");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  onProgress?.("Parsing backup…");
  const canvasesStr = await zip.file("canvases.json")?.async("string");
  const projectsStr = await zip.file("projects.json")?.async("string");
  const settingsStr = await zip.file("settings.json")?.async("string");

  if (!canvasesStr || !projectsStr) {
    throw new Error("Invalid backup zip (missing canvases.json/projects.json)");
  }

  const rawCanvases: unknown = JSON.parse(canvasesStr);
  const rawProjects: unknown = JSON.parse(projectsStr);
  const rawSettings: unknown = settingsStr ? JSON.parse(settingsStr) : [];

  if (!Array.isArray(rawCanvases) || !Array.isArray(rawProjects) || !Array.isArray(rawSettings)) {
    throw new Error("Invalid backup zip (unexpected JSON format)");
  }

  onProgress?.("Validating canvases…");
  const canvases: UnifiedCanvas[] = rawCanvases.map((rawCanvas) => {
    const canvas = asRecord(rawCanvas, "canvas");
    const id = asOptionalString(canvas.id) ?? "";
    if (!id) throw new Error("Invalid canvas.id");

    const name = asOptionalString(canvas.name) ?? id;
    const createdAt = parseDate(canvas.createdAt, `canvas.createdAt (${id})`);
    const updatedAt = parseDate(canvas.updatedAt, `canvas.updatedAt (${id})`);
    const lastEditedAt = canvas.lastEditedAt
      ? parseDate(canvas.lastEditedAt, `canvas.lastEditedAt (${id})`)
      : undefined;

    const elements = Array.isArray(canvas.elements)
      ? (canvas.elements as unknown as readonly ExcalidrawElement[])
      : [];

    return {
      id,
      name,
      thumbnail: asOptionalString(canvas.thumbnail),
      createdAt,
      updatedAt,
      lastEditedAt,
      projectId: asOptionalString(canvas.projectId),
      elements,
      appState: canvas.appState as UnifiedCanvas["appState"],
    };
  });

  onProgress?.("Validating projects…");
  const projects: UnifiedProject[] = rawProjects.map((rawProject) => {
    const project = asRecord(rawProject, "project");
    const id = asOptionalString(project.id) ?? "";
    if (!id) throw new Error("Invalid project.id");

    return {
      id,
      name: asOptionalString(project.name) ?? id,
      description: asOptionalString(project.description),
      color: asOptionalString(project.color) ?? "#6366f1",
      createdAt: parseDate(project.createdAt, `project.createdAt (${id})`),
      updatedAt: project.updatedAt ? parseDate(project.updatedAt, `project.updatedAt (${id})`) : undefined,
      canvasIds: asStringArray(project.canvasIds),
    };
  });

  onProgress?.("Validating settings…");
  const settings: AppSettings[] = rawSettings.map((rawSetting) => {
    const setting = asRecord(rawSetting, "setting");
    const key = asOptionalString(setting.key) ?? "";
    if (!key) throw new Error("Invalid setting.key");

    return {
      key,
      value: setting.value,
      updatedAt: parseDate(setting.updatedAt, `setting.updatedAt (${key})`),
    };
  });

  return normalizeRelationships({ canvases, projects, settings });
};

export const normalizeRelationships = (data: ParsedBackupZip): ParsedBackupZip => {
  const canvases = data.canvases.map((c) => ({ ...c }));
  const projects = data.projects.map((p) => ({
    ...p,
    canvasIds: Array.from(new Set(p.canvasIds ?? [])),
  }));
  const settings = data.settings.slice();

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const canvasById = new Map(canvases.map((c) => [c.id, c]));

  // Prefer project.canvasIds as authoritative linkage.
  projects.forEach((project) => {
    project.canvasIds = project.canvasIds.filter((canvasId) => canvasById.has(canvasId));
    project.canvasIds.forEach((canvasId) => {
      const canvas = canvasById.get(canvasId);
      if (!canvas) return;
      canvas.projectId = project.id;
    });
  });

  // Ensure any canvas.projectId also appears in project.canvasIds (if that project exists).
  canvases.forEach((canvas) => {
    if (!canvas.projectId) return;
    const project = projectById.get(canvas.projectId);
    if (!project) {
      canvas.projectId = undefined;
      return;
    }
    if (!project.canvasIds.includes(canvas.id)) {
      project.canvasIds = [...project.canvasIds, canvas.id];
    }
  });

  return { canvases, projects, settings };
};

export const detectConflicts = async (
  data: ParsedBackupZip,
  onProgress?: (message: string) => void,
): Promise<ConflictReport> => {
  onProgress?.("Checking for conflicts…");

  const canvasIds = data.canvases.map((c) => c.id);
  const projectIds = data.projects.map((p) => p.id);
  const projectNames = data.projects.map((p) => p.name);
  const settingKeys = data.settings.map((s) => s.key);

  const [existingCanvases, existingProjects, existingSettings, existingProjectsByName] =
    await Promise.all([
      canvasIds.length > 0 ? unifiedDb.canvases.bulkGet(canvasIds) : Promise.resolve([]),
      projectIds.length > 0 ? unifiedDb.projects.bulkGet(projectIds) : Promise.resolve([]),
      settingKeys.length > 0 ? unifiedDb.settings.bulkGet(settingKeys) : Promise.resolve([]),
      projectNames.length > 0 ? unifiedDb.projects.where("name").anyOf(projectNames).toArray() : Promise.resolve([]),
    ]);

  const existingProjectNames = new Set(existingProjectsByName.map((p) => p.name));

  return {
    canvasIds: existingCanvases
      .map((c, idx) => (c ? canvasIds[idx] : null))
      .filter((id): id is string => Boolean(id)),
    projectIds: existingProjects
      .map((p, idx) => (p ? projectIds[idx] : null))
      .filter((id): id is string => Boolean(id)),
    projectNames: projectNames.filter((name) => existingProjectNames.has(name)),
    settingKeys: existingSettings
      .map((s, idx) => (s ? settingKeys[idx] : null))
      .filter((key): key is string => Boolean(key)),
  };
};

export const importBackupZip = async ({
  data,
  mode,
  onProgress,
}: {
  data: ParsedBackupZip;
  mode: ImportMode;
  onProgress?: (message: string) => void;
}): Promise<ImportResult> => {
  if (mode === "replace") {
    onProgress?.("Replacing data…");
    await backupOperations.importAllData(data);
    return {
      mode,
      imported: {
        canvases: data.canvases.length,
        projects: data.projects.length,
        settings: data.settings.length,
      },
      skipped: { canvases: [], projectsById: [], projectsByName: [], settings: [] },
      warnings: { canvasesOrphanedFromProject: [] },
    };
  }

  onProgress?.("Preparing merge…");
  const conflicts = await detectConflicts(data, onProgress);
  const conflictCanvasIds = new Set(conflicts.canvasIds);
  const conflictProjectIds = new Set(conflicts.projectIds);
  const conflictProjectNames = new Set(conflicts.projectNames);
  const conflictSettingKeys = new Set(conflicts.settingKeys);

  const skippedCanvases: Array<{ id: string; incomingName: string; existingName?: string }> = [];
  const skippedProjectsById: Array<{ id: string; incomingName: string; existingName?: string }> = [];
  const skippedProjectsByName: Array<{ id: string; name: string; existingId?: string }> = [];
  const skippedSettings: Array<{ key: string }> = [];
  const canvasesOrphanedFromProject: Array<{ id: string; name: string; projectId?: string }> = [];

  const projectsToAdd = data.projects.filter((p) => {
    if (conflictProjectIds.has(p.id)) {
      skippedProjectsById.push({ id: p.id, incomingName: p.name });
      return false;
    }
    if (conflictProjectNames.has(p.name)) {
      skippedProjectsByName.push({ id: p.id, name: p.name });
      return false;
    }
    return true;
  });

  const projectsToAddIds = new Set(projectsToAdd.map((p) => p.id));

  const canvasesToAdd = data.canvases.filter((c) => {
    if (conflictCanvasIds.has(c.id)) {
      skippedCanvases.push({ id: c.id, incomingName: c.name });
      return false;
    }
    return true;
  });

  const settingsToAdd = data.settings.filter((s) => {
    if (conflictSettingKeys.has(s.key)) {
      skippedSettings.push({ key: s.key });
      return false;
    }
    return true;
  });

  // Enrich skipped entries with existing names/IDs for better user reporting.
  if (skippedCanvases.length > 0) {
    const existing = await unifiedDb.canvases.bulkGet(skippedCanvases.map((s) => s.id));
    const existingNameById = new Map(
      existing.filter(Boolean).map((c) => [(c as UnifiedCanvas).id, (c as UnifiedCanvas).name]),
    );
    skippedCanvases.forEach((s) => {
      const existingName = existingNameById.get(s.id);
      if (existingName) s.existingName = existingName;
    });
  }

  if (skippedProjectsById.length > 0) {
    const existing = await unifiedDb.projects.bulkGet(skippedProjectsById.map((s) => s.id));
    const existingNameById = new Map(
      existing.filter(Boolean).map((p) => [(p as UnifiedProject).id, (p as UnifiedProject).name]),
    );
    skippedProjectsById.forEach((s) => {
      const existingName = existingNameById.get(s.id);
      if (existingName) s.existingName = existingName;
    });
  }

  if (skippedProjectsByName.length > 0) {
    const existingByName = await unifiedDb.projects
      .where("name")
      .anyOf(skippedProjectsByName.map((s) => s.name))
      .toArray();
    const existingIdByName = new Map(existingByName.map((p) => [p.name, p.id]));
    skippedProjectsByName.forEach((s) => {
      const existingId = existingIdByName.get(s.name);
      if (existingId) s.existingId = existingId;
    });
  }

  // Determine which project IDs exist already (for linking canvases).
  const importedProjectIds = Array.from(new Set(canvasesToAdd.map((c) => c.projectId).filter(Boolean))) as string[];
  const existingProjectsForImportedCanvases = importedProjectIds.length
    ? await unifiedDb.projects.bulkGet(importedProjectIds)
    : [];
  const existingProjectIdsForImportedCanvases = new Set<string>(
    existingProjectsForImportedCanvases.filter(Boolean).map((p) => (p as UnifiedProject).id),
  );

  const resultingProjectIds = new Set<string>([
    ...existingProjectIdsForImportedCanvases,
    ...projectsToAddIds,
  ]);

  // If a canvas references a project that won't exist after merge, orphan it.
  canvasesToAdd.forEach((canvas) => {
    if (!canvas.projectId) return;
    if (!resultingProjectIds.has(canvas.projectId)) {
      const orphanedProjectId = canvas.projectId;
      canvas.projectId = undefined;
      canvasesOrphanedFromProject.push({ id: canvas.id, name: canvas.name, projectId: orphanedProjectId });
    }
  });

  // For any imported canvases that belong to an existing project, append their IDs to that project's canvasIds.
  const importedCanvasIdsByExistingProjectId = new Map<string, Set<string>>();
  canvasesToAdd.forEach((canvas) => {
    if (!canvas.projectId) return;
    if (!existingProjectIdsForImportedCanvases.has(canvas.projectId)) return;
    const set = importedCanvasIdsByExistingProjectId.get(canvas.projectId) ?? new Set<string>();
    set.add(canvas.id);
    importedCanvasIdsByExistingProjectId.set(canvas.projectId, set);
  });

  const existingProjectsToUpdate: UnifiedProject[] = [];
  existingProjectsForImportedCanvases.forEach((project) => {
    if (!project) return;
    const toAdd = importedCanvasIdsByExistingProjectId.get(project.id);
    if (!toAdd || toAdd.size === 0) return;
    const mergedCanvasIds = Array.from(new Set([...(project.canvasIds ?? []), ...Array.from(toAdd)]));
    if (mergedCanvasIds.length === (project.canvasIds ?? []).length) return;
    existingProjectsToUpdate.push({ ...project, canvasIds: mergedCanvasIds, updatedAt: new Date() });
  });

  // For newly imported projects, set canvasIds based on imported canvases (do not move existing canvases).
  const importedCanvasIdsByNewProjectId = new Map<string, Set<string>>();
  canvasesToAdd.forEach((canvas) => {
    if (!canvas.projectId) return;
    if (!projectsToAddIds.has(canvas.projectId)) return;
    const set = importedCanvasIdsByNewProjectId.get(canvas.projectId) ?? new Set<string>();
    set.add(canvas.id);
    importedCanvasIdsByNewProjectId.set(canvas.projectId, set);
  });

  const projectsToAddFinal = projectsToAdd.map((project) => {
    const ids = importedCanvasIdsByNewProjectId.get(project.id) ?? new Set<string>();
    return { ...project, canvasIds: Array.from(ids) };
  });

  onProgress?.("Writing to database…");
  await unifiedDb.transaction("rw", unifiedDb.canvases, unifiedDb.projects, unifiedDb.settings, async () => {
    if (canvasesToAdd.length > 0) await unifiedDb.canvases.bulkAdd(canvasesToAdd);
    if (projectsToAddFinal.length > 0) await unifiedDb.projects.bulkAdd(projectsToAddFinal);
    if (existingProjectsToUpdate.length > 0) await unifiedDb.projects.bulkPut(existingProjectsToUpdate);
    if (settingsToAdd.length > 0) await unifiedDb.settings.bulkAdd(settingsToAdd);
  });

  return {
    mode,
    imported: {
      canvases: canvasesToAdd.length,
      projects: projectsToAddFinal.length,
      settings: settingsToAdd.length,
    },
    skipped: {
      canvases: skippedCanvases,
      projectsById: skippedProjectsById,
      projectsByName: skippedProjectsByName,
      settings: skippedSettings,
    },
    warnings: { canvasesOrphanedFromProject },
  };
};
