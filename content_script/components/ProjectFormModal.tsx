import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedProject } from "../../shared/types";

interface CreateProjectProps {
  mode: "create";
  onClose: () => void;
}

interface EditProjectProps {
  mode: "edit";
  project: UnifiedProject;
  onEdit: (newName: string, newColor: string) => void;
  onClose: () => void;
}

type Props = CreateProjectProps | EditProjectProps;

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

export const ProjectFormModal = React.memo(function ProjectFormModal(props: Props) {
  const { mode, onClose } = props;
  const { state, createProject } = useUnifiedState();
  
  const isEditMode = mode === "edit";
  const project = isEditMode ? (props as EditProjectProps).project : null;
  const onEdit = isEditMode ? (props as EditProjectProps).onEdit : null;

  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [selectedColor, setSelectedColor] = useState(
    project?.color || projectColors[0]
  );
  const [customColor, setCustomColor] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    project?.color 
      ? projectColors.indexOf(project.color) >= 0 
        ? projectColors.indexOf(project.color) 
        : 0
      : 0
  );
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select text for edit mode
  useEffect(() => {
    if (isEditMode) {
      const focusTimeout = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
      return () => clearTimeout(focusTimeout);
    } else {
      // Just focus for create mode
      const focusTimeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimeout);
    }
  }, [isEditMode]);

  // Handle escape key
  useEffect(() => {
    const unsubscribe = eventBus.on(InternalEventTypes.ESCAPE_PRESSED, onClose);
    return unsubscribe;
  }, [onClose]);

  // Handle custom color initialization for edit mode
  useEffect(() => {
    if (isEditMode && project?.color && !projectColors.includes(project.color)) {
      setShowCustomPicker(true);
      setCustomColor(project.color);
      setSelectedColorIndex(0);
    }
  }, [isEditMode, project?.color]);

  const validateForm = useCallback(() => {
    if (!name.trim()) {
      setError("Project name is required");
      return false;
    }

    if (name.trim().length > 50) {
      setError("Project name must be 50 characters or less");
      return false;
    }

    // Check for duplicate names (only for create mode or if name changed in edit mode)
    if (mode === "create" || (project && name.trim() !== project.name)) {
      const existingProject = state.projects.find(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
      );

      if (existingProject) {
        setError("A project with this name already exists");
        return false;
      }
    }

    return true;
  }, [name, mode, project, state.projects]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // For edit mode, check if anything actually changed
    if (isEditMode && project && name.trim() === project.name && selectedColor === project.color) {
      onClose();
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && onEdit) {
        await onEdit(name.trim(), selectedColor);
      } else {
        // Create new project
        const newProject = await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          canvasIds: [],
          fileIds: [], // Backward compatibility
          color: selectedColor,
          updatedAt: new Date(),
        });

        // Emit project creation event
        eventBus.emit(InternalEventTypes.PROJECT_CREATED, newProject);
      }
      
      onClose();
    } catch (err) {
      setError(`Failed to ${isEditMode ? 'update' : 'create'} project. Please try again.`);
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} project:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, isEditMode, project, name, selectedColor, onClose, onEdit, createProject, description]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError("");
  }, [error]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    if (error && error.includes("description")) setError("");
  }, [error]);

  const handleColorSelect = useCallback((color: string, index: number) => {
    setSelectedColorIndex(index);
    setSelectedColor(color);
    setShowCustomPicker(false);
  }, []);

  const handleCustomColorToggle = useCallback(() => {
    setShowCustomPicker(!showCustomPicker);
  }, [showCustomPicker]);

  const handleKeyboardNavigation = useCallback((e: React.KeyboardEvent) => {
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
  }, [selectedColorIndex]);

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

  const textareaStyles: React.CSSProperties = {
    ...inputStyles,
    minHeight: "80px",
    resize: "vertical" as const,
    fontFamily: "inherit",
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
        onClick={(e) => e.stopPropagation()}
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
              {isEditMode ? "Edit Project" : "Create New Project"}
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
            {isEditMode 
              ? "Update the project name and color" 
              : "Organize your canvases into projects for better management"
            }
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

            {!isEditMode && (
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
                  Description (Optional)
                </label>
                <textarea
                  style={textareaStyles}
                  placeholder="Describe your project..."
                  value={description}
                  onChange={handleDescriptionChange}
                  maxLength={200}
                  disabled={isLoading}
                />
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--theme-text-secondary)",
                    marginTop: "4px",
                    textAlign: "right",
                  }}
                >
                  {description.length}/200
                </div>
              </div>
            )}

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
                  onKeyDown={handleKeyboardNavigation}
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
                      onClick={() => handleColorSelect(color, index)}
                      disabled={isLoading}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleCustomColorToggle}
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
              !error.includes("name") &&
              !error.includes("description") && (
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
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditMode ? "Update Project" : "Create Project"
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
});