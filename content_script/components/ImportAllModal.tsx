import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, Upload, X } from "lucide-react";
import type { ConflictReport, ImportMode, ImportResult, ParsedBackupZip } from "../services/backupImportAll";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";

type Phase = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

interface Props {
  isOpen: boolean;
  phase: Phase;
  mode: ImportMode;
  fileName?: string;
  parsed?: ParsedBackupZip;
  conflicts?: ConflictReport;
  progressMessage?: string;
  result?: ImportResult;
  errorMessage?: string | null;
  onClose: () => void;
  onPickFile: () => void;
  onFileSelected: (file: File) => void;
  onModeChange: (mode: ImportMode) => void;
  onStartImport: () => void;
  onReset: () => void;
}

const count = (items?: unknown[]) => (Array.isArray(items) ? items.length : 0);
const formatIdName = (id: string, name?: string) => (name ? `${name} (${id})` : id);

const buildImportTreeLines = ({
  parsed,
  result,
}: {
  parsed: ParsedBackupZip;
  result: ImportResult;
}): string[] => {
  const renderTree = (
    entries: string[],
    basePrefix = "",
  ): string[] => {
    return entries.map((entry, idx) => {
      const isLast = idx === entries.length - 1;
      const branch = isLast ? "└─ " : "├─ ";
      return `${basePrefix}${branch}${entry}`;
    });
  };

  const isReplace = result.mode === "replace";
  const skippedCanvasById = new Map(result.skipped.canvases.map((c) => [c.id, c]));
  const skippedProjectById = new Map(result.skipped.projectsById.map((p) => [p.id, p]));
  const skippedProjectByName = new Map(result.skipped.projectsByName.map((p) => [p.id, p]));
  const skippedSettingKeys = new Set(result.skipped.settings.map((s) => s.key));
  const orphanedCanvasById = new Map(result.warnings.canvasesOrphanedFromProject.map((c) => [c.id, c]));

  const projectById = new Map(parsed.projects.map((p) => [p.id, p]));
  const canvasesByProjectId = new Map<string, Array<{ id: string; name: string }>>();
  const rootCanvases: Array<{ id: string; name: string }> = [];

  parsed.canvases.forEach((c) => {
    if (!c.projectId) {
      rootCanvases.push({ id: c.id, name: c.name });
      return;
    }
    const arr = canvasesByProjectId.get(c.projectId) ?? [];
    arr.push({ id: c.id, name: c.name });
    canvasesByProjectId.set(c.projectId, arr);
  });

  const statusForProject = (projectId: string, projectName: string): string => {
    if (isReplace) return "[imported]";
    const skippedById = skippedProjectById.get(projectId);
    if (skippedById) {
      const extra =
        skippedById.existingName && skippedById.existingName !== skippedById.incomingName
          ? ` — existing: ${skippedById.existingName}`
          : "";
      return `[skipped:id-exists]${extra}`;
    }
    const skippedByName = skippedProjectByName.get(projectId);
    if (skippedByName) {
      const extra = skippedByName.existingId ? ` — existing id: ${skippedByName.existingId}` : "";
      return `[skipped:name-exists]${extra}`;
    }
    // If it was skipped by name but id map doesn't have it (shouldn't happen), fallback.
    const nameConflict = result.skipped.projectsByName.find((p) => p.name === projectName);
    if (nameConflict) {
      const extra = nameConflict.existingId ? ` — existing id: ${nameConflict.existingId}` : "";
      return `[skipped:name-exists]${extra}`;
    }
    return "[imported]";
  };

  const statusForCanvas = (canvasId: string): string => {
    if (isReplace) return "[imported]";
    const skipped = skippedCanvasById.get(canvasId);
    if (skipped) {
      const extra =
        skipped.existingName && skipped.existingName !== skipped.incomingName
          ? ` — existing: ${skipped.existingName}`
          : "";
      return `[skipped:id-exists]${extra}`;
    }
    const orphaned = orphanedCanvasById.get(canvasId);
    if (orphaned) return "[imported→main]";
    return "[imported]";
  };

  const statusForSetting = (key: string): string => {
    if (isReplace) return "[imported]";
    return skippedSettingKeys.has(key) ? "[skipped:key-exists]" : "[imported]";
  };

  const lines: string[] = [];
  lines.push("Canvases/");
  {
    const canvasEntries = rootCanvases
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `${statusForCanvas(c.id)} ${formatIdName(c.id, c.name)}`);
    lines.push(...renderTree(canvasEntries, ""));
  }

  lines.push("");
  lines.push("Projects/");

  {
    const sortedProjects = parsed.projects.slice().sort((a, b) => a.name.localeCompare(b.name));
    sortedProjects.forEach((p, projectIndex) => {
      const isLastProject = projectIndex === sortedProjects.length - 1;
      const projectBranch = isLastProject ? "└─ " : "├─ ";
      const childPrefix = isLastProject ? "   " : "│  ";

      lines.push(`${projectBranch}${statusForProject(p.id, p.name)} ${formatIdName(p.id, p.name)}`);

      const projectCanvases = (canvasesByProjectId.get(p.id) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => `${statusForCanvas(c.id)} ${formatIdName(c.id, c.name)}`);

      if (projectCanvases.length > 0) {
        lines.push(...renderTree(projectCanvases, childPrefix));
      }
    });
  }

  // Also show projects that were skipped by name/id but may not be in parsed.projects (defensive).
  if (!isReplace) {
    const extraProjects: string[] = [];
    result.skipped.projectsById.forEach((p) => {
      if (projectById.has(p.id)) return;
      const extra =
        p.existingName && p.existingName !== p.incomingName ? ` — existing: ${p.existingName}` : "";
      extraProjects.push(`[skipped:id-exists]${extra} ${formatIdName(p.id, p.incomingName)}`);
    });
    result.skipped.projectsByName.forEach((p) => {
      if (projectById.has(p.id)) return;
      const extra = p.existingId ? ` — existing id: ${p.existingId}` : "";
      extraProjects.push(`[skipped:name-exists]${extra} ${p.name} (${p.id})`);
    });
    if (extraProjects.length > 0) {
      lines.push(...renderTree(extraProjects.sort((a, b) => a.localeCompare(b)), ""));
    }
  }

  lines.push("");
  lines.push("Settings/");
  {
    const settingEntries = parsed.settings
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((s) => `${statusForSetting(s.key)} ${s.key}`);
    lines.push(...renderTree(settingEntries, ""));
  }

  return lines;
};

export function ImportAllModal({
  isOpen,
  phase,
  mode,
  fileName,
  parsed,
  conflicts,
  progressMessage,
  result,
  errorMessage,
  onClose,
  onPickFile,
  onFileSelected,
  onModeChange,
  onStartImport,
  onReset,
}: Props) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const skippedCounts = useMemo(() => {
    if (!result) return { canvases: 0, projects: 0, projectsById: 0, projectsByName: 0, settings: 0 };
    return {
      canvases: result.skipped.canvases.length,
      projects: result.skipped.projectsById.length + result.skipped.projectsByName.length,
      projectsById: result.skipped.projectsById.length,
      projectsByName: result.skipped.projectsByName.length,
      settings: result.skipped.settings.length,
    };
  }, [result]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = eventBus.on(InternalEventTypes.ESCAPE_PRESSED, () => {
      if (phase === "importing") return;
      onClose();
    });
    return unsubscribe;
  }, [isOpen, phase, onClose]);

  useEffect(() => {
    if (phase !== "done") return;
    setIsAdvancedOpen(false);
  }, [phase]);

  const canClose = phase !== "importing";
  const canStart = phase === "ready" && Boolean(parsed) && (mode === "replace" || Boolean(conflicts));

  const handleMergeCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (phase === "importing") return;
      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
      if (event.key === " " || event.key === "Spacebar") event.preventDefault();
      onModeChange("merge");
    },
    [phase, onModeChange],
  );

  const handleReplaceCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (phase === "importing") return;
      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
      if (event.key === " " || event.key === "Spacebar") event.preventDefault();
      onModeChange("replace");
    },
    [phase, onModeChange],
  );

  const conflictCounts = useMemo(() => {
    return {
      canvases: count(conflicts?.canvasIds),
      projectsById: count(conflicts?.projectIds),
      projectsByName: count(conflicts?.projectNames),
      settings: count(conflicts?.settingKeys),
    };
  }, [conflicts]);

  const treeLines = useMemo(() => {
    if (phase !== "done") return null;
    if (!parsed || !result) return null;
    return buildImportTreeLines({ parsed, result });
  }, [parsed, result, phase]);

  if (!isOpen) return null;

  const overlayStyles: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.6)",
    zIndex: 10000000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    backdropFilter: "blur(4px)",
  };

  const modalStyles: React.CSSProperties = {
    background: "var(--theme-bg-primary, #ffffff)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    borderRadius: "16px",
    boxShadow: "var(--theme-shadow-lg, 0 20px 40px rgba(0, 0, 0, 0.15))",
    width: "640px",
    maxWidth: "92vw",
    maxHeight: "90vh",
    overflow: "hidden",
    pointerEvents: "auto",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  };

  const sectionStyles: React.CSSProperties = {
    padding: "16px 20px",
    borderTop: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
  };

  const headerRowStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px 20px",
    flexShrink: 0,
  };

  const bodyStyles: React.CSSProperties = {
    overflow: "auto",
    flex: 1,
  };

  const pillStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    background: "var(--theme-bg-secondary, #f5f5f5)",
    border: "1px solid var(--theme-border-primary, rgba(0,0,0,0.1))",
    color: "var(--theme-text-secondary, #6b7280)",
  };

  const radioRow: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  };

  const modeCard = (active: boolean): React.CSSProperties => ({
    flex: "1 1 240px",
    borderRadius: "12px",
    border: `1px solid ${
      active ? "var(--theme-accent-primary, #6366f1)" : "var(--theme-border-primary, rgba(0,0,0,0.1))"
    }`,
    background: active ? "rgba(99, 102, 241, 0.08)" : "var(--theme-bg-primary, #ffffff)",
    padding: "12px",
    cursor: phase === "importing" ? "not-allowed" : "pointer",
    opacity: phase === "importing" ? 0.6 : 1,
  });

  const buttonStyles: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--theme-border-primary, rgba(0,0,0,0.1))",
    background: "var(--theme-bg-secondary, #f5f5f5)",
    color: "var(--theme-text-primary, #111827)",
    cursor: phase === "importing" ? "not-allowed" : "pointer",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  };

  const primaryButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    border: "none",
    background: "var(--theme-accent-primary, #6366f1)",
    color: "var(--theme-text-on-accent, #ffffff)",
    opacity: canStart ? 1 : 0.6,
  };

  return createPortal(
    <div
      style={overlayStyles}
      onClick={(e) => {
        if (!canClose) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        style={modalStyles}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (phase === "importing") return;
          setIsDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (phase === "importing") return;
          setIsDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(false);
          if (phase === "importing") return;
          const file = e.dataTransfer?.files?.[0];
          if (!file) return;
          if (!file.name.toLowerCase().endsWith(".zip")) return;
          onFileSelected(file);
        }}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {isDragActive && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "16px",
              background: "rgba(99, 102, 241, 0.12)",
              border: "2px dashed var(--theme-accent-primary, #6366f1)",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "var(--theme-bg-primary, #ffffff)",
                border: "1px solid var(--theme-border-primary, rgba(0,0,0,0.1))",
                borderRadius: "12px",
                padding: "14px 16px",
                color: "var(--theme-text-primary, #111827)",
                fontWeight: 800,
              }}
            >
              Drop zip to import
            </div>
          </div>
        )}
        <div style={headerRowStyles}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  phase === "done"
                    ? "rgba(16, 185, 129, 0.12)"
                    : phase === "error"
                      ? "rgba(239, 68, 68, 0.12)"
                      : "rgba(99, 102, 241, 0.12)",
              }}
            >
              {phase === "done" ? (
                <CheckCircle2 size={20} style={{ color: "var(--theme-success, #10b981)" }} />
              ) : phase === "error" ? (
                <AlertTriangle size={20} style={{ color: "var(--theme-error, #ef4444)" }} />
              ) : (
                <Upload size={20} style={{ color: "var(--theme-accent-primary, #6366f1)" }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--theme-text-primary, #111827)" }}>
                Import all
              </div>
              <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)", marginTop: "2px" }}>
                Import an “Export all” zip into Excali Organizer
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!canClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: canClose ? "pointer" : "not-allowed",
              padding: "6px",
              borderRadius: "8px",
              color: "var(--theme-text-secondary, #6b7280)",
              opacity: canClose ? 1 : 0.5,
            }}
            title={canClose ? "Close" : "Import in progress"}
          >
            <X size={18} />
          </button>
        </div>

        <div style={bodyStyles}>
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(239, 68, 68, 0.08)",
              borderTop: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
              borderBottom: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
              color: "var(--theme-text-primary, #111827)",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(239, 68, 68, 0.14)",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={16} style={{ color: "var(--theme-error, #ef4444)" }} />
            </div>
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.4,
                color: "var(--theme-text-secondary, #6b7280)",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "4px",
              }}
            >
              <span style={{ fontWeight: 800, color: "var(--theme-text-primary, #111827)" }}>
                Recommended:
              </span>
              <span>
                create a backup first using <span style={{ fontWeight: 700 }}>“Export all”</span> before importing.
              </span>
            </div>
          </div>
          <div style={sectionStyles}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--theme-text-primary, #111827)" }}>
                Import mode
              </div>
              <span style={pillStyles}>
                {mode === "merge" ? "Merge (skip conflicts)" : "Replace (clears existing data)"}
              </span>
            </div>

            <div style={{ marginTop: "10px", ...radioRow }}>
              <div
                role="button"
                tabIndex={0}
                style={modeCard(mode === "merge")}
                onClick={() => phase !== "importing" && onModeChange("merge")}
                onKeyDown={handleMergeCardKeyDown}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="radio"
                    checked={mode === "merge"}
                    onChange={() => onModeChange("merge")}
                    disabled={phase === "importing"}
                  />
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--theme-text-primary, #111827)" }}>Merge</div>
                    <div style={{ fontSize: "12px", color: "var(--theme-text-secondary, #6b7280)", marginTop: "2px" }}>
                      Safest. Keeps your existing data. Skips items whose IDs already exist.
                    </div>
                  </div>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                style={modeCard(mode === "replace")}
                onClick={() => phase !== "importing" && onModeChange("replace")}
                onKeyDown={handleReplaceCardKeyDown}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="radio"
                    checked={mode === "replace"}
                    onChange={() => onModeChange("replace")}
                    disabled={phase === "importing"}
                  />
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--theme-text-primary, #111827)" }}>Replace</div>
                    <div style={{ fontSize: "12px", color: "var(--theme-text-secondary, #6b7280)", marginTop: "2px" }}>
                      Clears your current projects/canvases/settings, then imports the zip.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={sectionStyles}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--theme-text-primary, #111827)" }}>
                Backup file
              </div>
              <button onClick={onPickFile} style={buttonStyles} disabled={phase === "importing"}>
                <Upload size={16} />
                Choose zip…
              </button>
            </div>
            <div style={{ marginTop: "10px", fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
              {fileName ? `Selected: ${fileName}` : "No file selected."}
            </div>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--theme-text-secondary, #6b7280)" }}>
              Tip: You can also drag & drop the zip anywhere on this dialog.
            </div>
          </div>

          <div style={sectionStyles}>
            {phase === "idle" && (
              <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                Pick a zip exported from “Export all”.
              </div>
            )}

            {(phase === "parsing" || phase === "importing") && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <motion.div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "999px",
                    background: "var(--theme-accent-primary, #6366f1)",
                  }}
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
                <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                  {progressMessage || (phase === "parsing" ? "Parsing…" : "Importing…")}
                </div>
              </div>
            )}

            {phase === "ready" && parsed && (
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={pillStyles}>Canvases: {parsed.canvases.length}</span>
                  <span style={pillStyles}>Projects: {parsed.projects.length}</span>
                  <span style={pillStyles}>Settings: {parsed.settings.length}</span>
                  {mode === "merge" && (
                    <>
                      <span style={pillStyles}>Conflicting canvases: {conflictCounts.canvases}</span>
                      <span style={pillStyles}>Conflicting projects (ID): {conflictCounts.projectsById}</span>
                      <span style={pillStyles}>Conflicting projects (name): {conflictCounts.projectsByName}</span>
                      <span style={pillStyles}>Conflicting settings: {conflictCounts.settings}</span>
                    </>
                  )}
                </div>

                {mode === "replace" ? (
                  <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                    Replace mode will delete your existing organizer data before importing.
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                    Merge mode skips items that would conflict by ID (and skips projects whose names already exist).
                  </div>
                )}
              </div>
            )}

            {phase === "done" && result && (
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <span style={pillStyles}>Imported canvases: {result.imported.canvases}</span>
                <span style={pillStyles}>Imported projects: {result.imported.projects}</span>
                <span style={pillStyles}>Imported settings: {result.imported.settings}</span>
                <span style={pillStyles}>Skipped canvases: {skippedCounts.canvases}</span>
                <span style={pillStyles}>Skipped projects: {skippedCounts.projects}</span>
                <span style={pillStyles}>Skipped settings: {skippedCounts.settings}</span>
              </div>
                {(skippedCounts.canvases > 0 ||
                  skippedCounts.projectsById > 0 ||
                  skippedCounts.projectsByName > 0 ||
                  skippedCounts.settings > 0) && (
                  <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                    Details: skipped projects by ID {skippedCounts.projectsById} + by name {skippedCounts.projectsByName}.
                  </div>
                )}
                {result.warnings.canvasesOrphanedFromProject.length > 0 && (
                  <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                    Note: {result.warnings.canvasesOrphanedFromProject.length} imported canvas(es) were placed in the main
                    canvases list because their project wasn’t imported.
                  </div>
                )}

                <div
                  style={{
                    marginTop: "4px",
                    borderRadius: "12px",
                    border: "1px solid var(--theme-border-primary, rgba(0,0,0,0.1))",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "var(--theme-bg-secondary, #f5f5f5)",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--theme-text-primary, #111827)",
                      fontWeight: 800,
                    }}
                  >
                    <span>Advanced details</span>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: isAdvancedOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </button>
                  {isAdvancedOpen && (
                    <div style={{ padding: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                        <div style={{ fontSize: "12px", color: "var(--theme-text-secondary, #6b7280)" }}>
                          Skipped IDs/names + warnings (copyable report)
                        </div>
                        <button
                          onClick={async () => {
                            const reportLines = [
                              `Import report (${result.mode})`,
                              "",
                              `Imported canvases: ${result.imported.canvases}`,
                              `Imported projects: ${result.imported.projects}`,
                              `Imported settings: ${result.imported.settings}`,
                              `Skipped canvases: ${skippedCounts.canvases}`,
                              `Skipped projects: ${skippedCounts.projects} (IDs: ${skippedCounts.projectsById}, names: ${skippedCounts.projectsByName})`,
                              `Skipped settings: ${skippedCounts.settings}`,
                              "",
                              ...(treeLines ?? []),
                            ];
                            const report = reportLines.join("\n");

                            try {
                              await navigator.clipboard.writeText(report);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1500);
                            } catch {
                              // noop
                            }
                          }}
                          style={{
                            ...buttonStyles,
                            padding: "8px 10px",
                            fontSize: "12px",
                          }}
                        >
                          <Copy size={14} />
                          {copied ? "Copied" : "Copy report"}
                        </button>
                      </div>

                      <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
                        <div style={{ fontSize: "12px", color: "var(--theme-text-primary, #111827)", fontWeight: 800 }}>
                          Tree view
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--theme-text-secondary, #6b7280)" }}>
                          Canvases: {result.skipped.canvases.length} • Project IDs: {result.skipped.projectsById.length} •
                          Project names: {result.skipped.projectsByName.length} • Setting keys: {result.skipped.settings.length}
                        </div>
                        <div
                          style={{
                            borderRadius: "10px",
                            border: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
                            background: "var(--theme-bg-primary, #ffffff)",
                            padding: "10px",
                            maxHeight: "320px",
                            overflow: "auto",
                            fontFamily: "monospace",
                            fontSize: "11px",
                            color: "var(--theme-text-secondary, #6b7280)",
                            whiteSpace: "pre",
                          }}
                        >
                          {(treeLines ?? ["(tree unavailable)"]).join("\n")}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "error" && (
              <div style={{ fontSize: "13px", color: "var(--theme-error, #ef4444)" }}>
                {errorMessage || "Import failed. Please try again."}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onReset}
            style={{
              ...buttonStyles,
              background: "transparent",
            }}
            disabled={phase === "importing"}
          >
            Reset
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onClose} style={buttonStyles} disabled={!canClose}>
              Close
            </button>
            <button
              onClick={onStartImport}
              style={primaryButtonStyles}
              disabled={!canStart}
              title={!canStart ? "Select a file first" : "Start import"}
            >
              {phase === "importing" ? "Importing…" : phase === "done" ? "Imported" : "Import"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
