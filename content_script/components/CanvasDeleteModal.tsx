import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { UnifiedCanvas } from "../../shared/types";

interface CanvasDeleteModalProps {
  canvas: UnifiedCanvas;
  onConfirm: () => void;
  onCancel: () => void;
}

const CanvasDeleteModal: React.FC<CanvasDeleteModalProps> = ({
  canvas,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    modalRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

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
    padding: "0",
    width: "480px",
    maxWidth: "90vw",
    maxHeight: "90vh",
    overflow: "hidden",
    pointerEvents: "auto",
  };

  const buttonStyles: React.CSSProperties = {
    padding: "12px 24px",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "100px",
  };

  const confirmButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    background: "var(--theme-error, #ef4444)",
    color: "white",
  };

  const cancelButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    background: "var(--theme-bg-secondary, #f5f5f5)",
    color: "var(--theme-text-primary, #1f2937)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
  };

  return createPortal(
    <div
      style={overlayStyles}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <motion.div
        ref={modalRef}
        style={modalStyles}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "24px 24px 0 24px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--theme-error-bg, rgba(239, 68, 68, 0.1))",
            }}
          >
            <AlertTriangle
              size={24}
              style={{ color: "var(--theme-error, #ef4444)" }}
            />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "700",
                color: "var(--theme-text-primary, #1f2937)",
                lineHeight: "1.2",
              }}
            >
              Delete Canvas
            </h3>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "14px",
                color: "var(--theme-text-secondary, #6b7280)",
                lineHeight: "1.4",
              }}
            >
              This action cannot be undone
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "0 24px", marginBottom: "24px" }}>
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "16px",
              color: "var(--theme-text-primary, #1f2937)",
              lineHeight: "1.5",
            }}
          >
            Are you sure you want to delete "
            <strong style={{ color: "var(--theme-text-primary, #1f2937)" }}>
              {canvas.name}
            </strong>
            "?
          </p>
          <p
            style={{
              margin: "0",
              fontSize: "14px",
              color: "var(--theme-text-secondary, #6b7280)",
              lineHeight: "1.4",
            }}
          >
            This will permanently remove the canvas and all its content. You
            won't be able to recover it.
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "0 24px 24px 24px",
            justifyContent: "flex-end",
          }}
        >
          <button
            style={cancelButtonStyles}
            onClick={onCancel}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--theme-bg-hover, #e5e5e5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "var(--theme-bg-secondary, #f5f5f5)";
            }}
          >
            Cancel
          </button>
          <button
            style={confirmButtonStyles}
            onClick={onConfirm}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#dc2626";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--theme-error, #ef4444)";
            }}
            autoFocus
          >
            Delete Canvas
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default CanvasDeleteModal;