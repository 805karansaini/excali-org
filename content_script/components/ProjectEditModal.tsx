import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedProject } from "../../shared/types";

interface Props {
  project: UnifiedProject;
  onEdit: (newName: string, newColor: string) => void;
  onClose: () => void;
}

const projectColors = [
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#a855f7", // Violet
];

export function ProjectEditModal({ project, onEdit, onClose }: Props) {
  const [name, setName] = useState(project.name);
  const [selectedColor, setSelectedColor] = useState(project.color || projectColors[0]);
  const [customColor, setCustomColor] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    projectColors.indexOf(project.color || projectColors[0])
  );
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);

    const unsubscribe = eventBus.on(InternalEventTypes.ESCAPE_PRESSED, onClose);

    return () => {
      clearTimeout(focusTimeout);
      unsubscribe();
    };
  }, [onClose]);

  // If current color is not in the predefined colors, treat it as custom
  useEffect(() => {
    if (project.color && !projectColors.includes(project.color)) {
      setShowCustomPicker(true);
      setCustomColor(project.color);
      setSelectedColorIndex(0); // Default to first color index for keyboard navigation
    }
  }, [project.color]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    if (name.trim().length > 50) {
      setError("Project name must be 50 characters or less");
      return;
    }

    // Only proceed if name or color has changed
    if (name.trim() === project.name && selectedColor === project.color) {
      onClose();
      return;
    }

    setIsLoading(true);
    
    try {
      await onEdit(name.trim(), selectedColor);
      onClose();
    } catch (err) {
      setError("Failed to update project. Please try again.");
      console.error("Error updating project:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError("");
  };

  const overlayStyles: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "var(--theme-bg-primary, #ffffff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999999,
    pointerEvents: "auto",
  };

  const modalStyles: React.CSSProperties = {
    width: "100%",
    maxWidth: "500px",
    background: "var(--theme-bg-primary, #ffffff)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    borderRadius: "16px",
    boxShadow: "var(--theme-shadow-lg, 0 20px 40px rgba(0, 0, 0, 0.1))",
    overflow: "hidden",
    margin: "0 16px",
  };

  const headerStyles: React.CSSProperties = {
    padding: "24px 24px 20px",
    borderBottom: "1px solid var(--theme-border-secondary)",
  };

  const inputStyles: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "var(--theme-bg-tertiary)",
    border: "1px solid var(--theme-border-primary)",
    borderRadius: "8px",
    color: "var(--theme-text-primary)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  return createPortal(
    <motion.div
      style={overlayStyles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        style={modalStyles}
        initial={{ scale: 0.9, y: -50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: -50 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
      >
        <div style={headerStyles}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--theme-text-primary)",
                margin: 0,
              }}
            >
              Edit Project
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--theme-text-secondary)",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "var(--theme-text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Update the project name and color
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "24px" }}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--theme-text-primary)",
                  marginBottom: "8px",
                }}
              >
                Project Name *
              </label>
              <input
                ref={inputRef}
                type="text"
                style={{
                  ...inputStyles,
                  borderColor:
                    error && !name.trim()
                      ? "var(--theme-error, #ef4444)"
                      : name.trim()
                        ? "var(--theme-success, #10b981)"
                        : undefined,
                }}
                placeholder="Enter project name..."
                value={name}
                onChange={handleNameChange}
                maxLength={50}
                disabled={isLoading}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--theme-text-secondary)",
                  marginTop: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{error && error.includes("name") ? error : ""}</span>
                <span>{name.length}/50</span>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--theme-text-primary)",
                  marginBottom: "12px",
                }}
              >
                Project Color
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  tabIndex={0}
                  role="radiogroup"
                  aria-label="Choose project color"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: "8px",
                    maxWidth: "200px",
                    padding: "4px",
                    borderRadius: "8px",
                    border: "2px solid transparent",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      const nextIndex = (selectedColorIndex + 1) % projectColors.length;
                      setSelectedColorIndex(nextIndex);
                      setSelectedColor(projectColors[nextIndex]);
                      setShowCustomPicker(false);
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const prevIndex = selectedColorIndex === 0 ? projectColors.length - 1 : selectedColorIndex - 1;
                      setSelectedColorIndex(prevIndex);
                      setSelectedColor(projectColors[prevIndex]);
                      setShowCustomPicker(false);
                    } else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      // Color is already selected, no additional action needed
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--theme-accent-primary, #6366f1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  {projectColors.map((color, index) => (
                    <button
                      key={color}
                      type="button"
                      tabIndex={-1}
                      role="radio"
                      aria-checked={selectedColor === color && !showCustomPicker}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        backgroundColor: color,
                        border:
                          selectedColor === color && !showCustomPicker
                            ? `3px solid var(--theme-text-primary)`
                            : "2px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxSizing: "border-box",
                      }}
                      onClick={() => {
                        setSelectedColorIndex(index);
                        setSelectedColor(color);
                        setShowCustomPicker(false);
                      }}
                      disabled={isLoading}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setShowCustomPicker(!showCustomPicker)}
                    disabled={isLoading}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      background: showCustomPicker ? "var(--theme-accent-primary, #6366f1)" : "var(--theme-bg-tertiary, #f8f9fa)",
                      color: showCustomPicker ? "var(--theme-text-on-accent, #ffffff)" : "var(--theme-text-secondary, #6b7280)",
                      border: "1px solid var(--theme-border-primary)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Custom Color
                  </button>
                  {showCustomPicker && (
                    <>
                      <input
                        type="color"
                        value={customColor || selectedColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          setSelectedColor(e.target.value);
                        }}
                        disabled={isLoading}
                        style={{
                          width: "32px",
                          height: "32px",
                          border: "2px solid var(--theme-border-primary)",
                          borderRadius: "4px",
                          cursor: "pointer",
                          background: "transparent",
                        }}
                      />
                      <input
                        type="text"
                        value={customColor || selectedColor}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                            setCustomColor(value);
                            if (value.length === 7) {
                              setSelectedColor(value);
                            }
                          }
                        }}
                        placeholder="#000000"
                        disabled={isLoading}
                        style={{
                          width: "80px",
                          padding: "6px 8px",
                          fontSize: "12px",
                          background: "var(--theme-bg-tertiary)",
                          border: "1px solid var(--theme-border-primary)",
                          borderRadius: "4px",
                          color: "var(--theme-text-primary)",
                          fontFamily: "monospace",
                        }}
                      />
                    </>
                  )}
                </div>
                
                <div style={{ fontSize: "12px", color: "var(--theme-text-secondary)" }}>
                  Use arrow keys to navigate colors, or choose a custom color
                </div>
              </div>
            </div>

            {error &&
              !error.includes("name") && (
                <div
                  style={{
                    background: "var(--theme-error-bg, rgba(239, 68, 68, 0.1))",
                    border:
                      "1px solid var(--theme-error-border, rgba(239, 68, 68, 0.3))",
                    borderRadius: "6px",
                    padding: "12px",
                    color: "var(--theme-error, #ef4444)",
                    fontSize: "14px",
                    marginBottom: "20px",
                  }}
                >
                  {error}
                </div>
              )}
          </div>

          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid var(--theme-border-secondary)",
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "1px solid var(--theme-border-primary)",
                borderRadius: "6px",
                color: "var(--theme-text-secondary)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
                transition: "all 0.2s ease",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              style={{
                padding: "10px 20px",
                background:
                  !name.trim() || isLoading
                    ? "var(--theme-bg-tertiary, #f8f9fa)"
                    : "var(--theme-accent-primary, #6366f1)",
                border: "none",
                borderRadius: "6px",
                color:
                  !name.trim() || isLoading
                    ? "var(--theme-text-secondary, #6b7280)"
                    : "var(--theme-text-on-accent, #ffffff)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: !name.trim() || isLoading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {isLoading ? (
                <>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid transparent",
                      borderTop: "2px solid currentColor",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Updating...
                </>
              ) : (
                "Update Project"
              )}
            </button>
          </div>
        </form>
      </motion.div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>,
    document.body,
  );
}