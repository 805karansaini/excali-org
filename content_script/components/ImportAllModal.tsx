import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Upload, X } from "lucide-react";
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
  onModeChange: (mode: ImportMode) => void;
  onStartImport: () => void;
  onReset: () => void;
}

const count = (items?: unknown[]) => (Array.isArray(items) ? items.length : 0);

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
  onModeChange,
  onStartImport,
  onReset,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = eventBus.on(InternalEventTypes.ESCAPE_PRESSED, () => {
      if (phase === "importing") return;
      onClose();
    });
    return unsubscribe;
  }, [isOpen, phase, onClose]);

  const canClose = phase !== "importing";
  const canStart = phase === "ready" && Boolean(parsed) && (mode === "replace" || Boolean(conflicts));

  const conflictCounts = useMemo(() => {
    return {
      canvases: count(conflicts?.canvasIds),
      projectsById: count(conflicts?.projectIds),
      projectsByName: count(conflicts?.projectNames),
      settings: count(conflicts?.settingKeys),
    };
  }, [conflicts]);

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
    width: "560px",
    maxWidth: "92vw",
    maxHeight: "90vh",
    overflow: "hidden",
    pointerEvents: "auto",
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
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
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
              </div>
              {(result.skipped.canvasIds.length > 0 ||
                result.skipped.projectIds.length > 0 ||
                result.skipped.projectNames.length > 0 ||
                result.skipped.settingKeys.length > 0) && (
                <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                  Skipped: canvases {result.skipped.canvasIds.length}, projects {result.skipped.projectIds.length} (IDs) +
                  {result.skipped.projectNames.length} (names), settings {result.skipped.settingKeys.length}.
                </div>
              )}
              {result.warnings.canvasIdsOrphanedFromProject.length > 0 && (
                <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
                  Note: {result.warnings.canvasIdsOrphanedFromProject.length} imported canvas(es) were placed in the main
                  canvases list because their project wasn’t imported.
                </div>
              )}
            </div>
          )}

          {phase === "error" && (
            <div style={{ fontSize: "13px", color: "var(--theme-error, #ef4444)" }}>
              {errorMessage || "Import failed. Please try again."}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
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
