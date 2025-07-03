import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface Props {
  currentName: string;
  onRename: (newName: string) => void;
  onClose: () => void;
}

export function RenameModal({ currentName, onRename, onClose }: Props) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);

    return () => clearTimeout(focusTimeout);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onRename(name.trim());
    }
    onClose();
  };

  const overlayStyles: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000000,
  };

  const modalStyles: React.CSSProperties = {
    background: "var(--theme-bg-primary)",
    padding: "24px",
    borderRadius: "8px",
    boxShadow: "var(--theme-shadow-lg)",
    width: "100%",
    maxWidth: "400px",
  };

  const inputStyles: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    border: "1px solid var(--theme-border-primary)",
    borderRadius: "4px",
    marginBottom: "16px",
    background: "var(--theme-bg-secondary)",
    color: "var(--theme-text-primary)",
  };

  return createPortal(
    <motion.div
      style={overlayStyles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={modalStyles}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "18px",
            color: "var(--theme-text-primary)",
          }}
        >
          Rename Canvas
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyles}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "var(--theme-bg-tertiary)",
                border: "1px solid var(--theme-border-primary)",
                color: "var(--theme-text-secondary)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                background: !name.trim()
                  ? "var(--theme-bg-tertiary, #f8f9fa)"
                  : "var(--theme-accent-primary, #6366f1)",
                border: "none",
                borderRadius: "6px",
                color: !name.trim()
                  ? "var(--theme-text-secondary, #6b7280)"
                  : "var(--theme-text-on-accent, #ffffff)",
                fontSize: "14px",
                cursor: !name.trim() ? "not-allowed" : "pointer",
              }}
              disabled={!name.trim()}
            >
              Rename
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
