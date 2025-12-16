import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Download, X } from "lucide-react";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";

type Phase = "idle" | "exporting" | "done" | "error";

interface Props {
  isOpen: boolean;
  phase: Phase;
  progressMessage?: string;
  counts?: { canvases: number; projects: number; settings: number };
  errorMessage?: string | null;
  onClose: () => void;
}

export function ExportAllModal({ isOpen, phase, progressMessage, counts, errorMessage, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = eventBus.on(InternalEventTypes.ESCAPE_PRESSED, () => {
      if (phase === "exporting") return;
      onClose();
    });
    return unsubscribe;
  }, [isOpen, phase, onClose]);

  if (!isOpen) return null;
  const canClose = phase !== "exporting";

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
    width: "520px",
    maxWidth: "92vw",
    overflow: "hidden",
    pointerEvents: "auto",
  };

  const sectionStyles: React.CSSProperties = {
    padding: "16px 20px",
    borderTop: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px 20px" }}>
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
                <Download size={20} style={{ color: "var(--theme-accent-primary, #6366f1)" }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--theme-text-primary, #111827)" }}>
                Export all
              </div>
              <div style={{ fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)", marginTop: "2px" }}>
                Creates a zip backup of canvases, projects, and settings
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
            title={canClose ? "Close" : "Export in progress"}
          >
            <X size={18} />
          </button>
        </div>

        <div style={sectionStyles}>
          {counts && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span style={pillStyles}>Canvases: {counts.canvases}</span>
              <span style={pillStyles}>Projects: {counts.projects}</span>
              <span style={pillStyles}>Settings: {counts.settings}</span>
            </div>
          )}

          {phase === "exporting" && (
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
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
                {progressMessage || "Exporting…"}
              </div>
            </div>
          )}

          {phase === "done" && (
            <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--theme-text-secondary, #6b7280)" }}>
              Download started. If you don’t see it, check your browser’s downloads.
            </div>
          )}

          {phase === "error" && (
            <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--theme-error, #ef4444)" }}>
              {errorMessage || "Export failed. Please try again."}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--theme-border-secondary, rgba(0,0,0,0.06))",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            onClick={onClose}
            disabled={!canClose}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid var(--theme-border-primary, rgba(0,0,0,0.1))",
              background: "var(--theme-bg-secondary, #f5f5f5)",
              color: "var(--theme-text-primary, #111827)",
              cursor: canClose ? "pointer" : "not-allowed",
              fontWeight: 700,
              opacity: canClose ? 1 : 0.6,
            }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

