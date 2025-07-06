import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Edit3,
  Trash2,
  Download,
  AlertTriangle,
} from "lucide-react";
import JSZip from "jszip";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { ProjectEditModal } from "./ProjectEditModal";
import { UnifiedProject } from "../../shared/types";
import { projectOperations } from "../../shared/unified-db";

interface Props {
  x: number;
  y: number;
  project: UnifiedProject;
  onClose: () => void;
}

export function ProjectContextMenu({ x, y, project, onClose }: Props) {
  const { dispatch } = useUnifiedState();
  const [isRenameModalOpen, setRenameModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCanvasAction, setDeleteCanvasAction] = useState<'keep' | 'delete'>('keep');
  const menuRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  // Position menu to stay within viewport
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 16) {
        adjustedX = viewportWidth - rect.width - 16;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight - 16) {
        adjustedY = viewportHeight - rect.height - 16;
      }

      // Ensure menu is not off-screen on the left or top
      adjustedX = Math.max(16, adjustedX);
      adjustedY = Math.max(16, adjustedY);

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!deleteModalRef.current || !deleteModalRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isRenameModalOpen) {
          setRenameModalOpen(false);
        } else {
          onClose();
        }
      }
    };

    // Delay adding listeners to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, showDeleteConfirm, isRenameModalOpen]);

  // Focus management for delete modal
  useEffect(() => {
    if (showDeleteConfirm && deleteModalRef.current) {
      deleteModalRef.current.focus();
    }
  }, [showDeleteConfirm]);

  const handleRename = async (newName: string, newColor: string) => {
    try {
      const updatedProject = await projectOperations.updateProjectFields(project.id, {
        name: newName,
        color: newColor,
      });

      // Update state
      dispatch({ type: "UPDATE_PROJECT", payload: updatedProject });

      // Emit event
      eventBus.emit(InternalEventTypes.PROJECT_RENAME_REQUEST, {
        projectId: project.id,
        oldName: project.name,
        newName: newName,
      });

      console.log("Project updated successfully:", { name: newName, color: newColor });
    } catch (error) {
      console.error("Failed to update project:", error);
      alert("Failed to update project. Please try again.");
    }
  };

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await projectOperations.deleteProjectWithOptions(
        project.id,
        deleteCanvasAction
      );

      // Update state with canvas action info
      dispatch({
        type: "DELETE_PROJECT",
        payload: {
          projectId: project.id,
          canvasAction: deleteCanvasAction
        }
      });

      // Emit event
      eventBus.emit(InternalEventTypes.PROJECT_DELETE_REQUEST, {
        project,
        canvasAction: deleteCanvasAction,
      });

      console.log(`Project deleted successfully. ${result.deletedCanvasCount} canvases ${deleteCanvasAction === 'delete' ? 'deleted' : 'moved to unorganized'}.`);

      // Close modal and context menu
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project. Please try again.");
      // Reset modal state on error
      setShowDeleteConfirm(false);
      setDeleteCanvasAction('keep');
    }
  };

  const handleExport = async () => {
    try {
      const exportData = await projectOperations.exportProject(project.id);

      // Create ZIP file structure
      const zip = new JSZip();

      // Add project metadata
      const projectMetadata = {
        id: exportData.project.id,
        name: exportData.project.name,
        description: exportData.project.description || "",
        color: exportData.project.color,
        createdAt: exportData.project.createdAt,
        updatedAt: exportData.project.updatedAt,
        canvasCount: exportData.canvases.length,
      };

      zip.file("project.json", JSON.stringify(projectMetadata, null, 2));

      // Create canvases directory
      const canvasesFolder = zip.folder("canvases");
      if (!canvasesFolder) {
        throw new Error("Failed to create canvases folder");
      }

      // Add each canvas as an individual .excalidraw file
      exportData.canvases.forEach((canvas) => {
        const canvasData = {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: canvas.elements || [],
          appState: canvas.appState || {
            theme: "light",
            viewBackgroundColor: "#ffffff",
            currentItemStrokeColor: "#000000",
            currentItemBackgroundColor: "transparent",
            currentItemFillStyle: "hachure",
            currentItemStrokeWidth: 1,
            currentItemStrokeStyle: "solid",
            currentItemRoughness: 1,
            currentItemOpacity: 100,
            currentItemFontSize: 20,
            currentItemFontFamily: 1,
            currentItemTextAlign: "left",
            currentItemStartArrowhead: null,
            currentItemEndArrowhead: "arrow",
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 },
            currentItemLinearStrokeSharpness: "round",
            gridSize: null,
            colorPalette: {},
          },
          files: {},
        };

        const filename = `canvas-${canvas.id}.excalidraw`;
        canvasesFolder.file(filename, JSON.stringify(canvasData, null, 2));
      });

      // Add export manifest
      const manifest = {
        exportVersion: "1.0.0",
        exportedAt: exportData.exportedAt,
        exportedBy: "Excali Organizer Extension",
        projectName: exportData.project.name,
        canvasCount: exportData.canvases.length,
        format: "zip",
        compatibility: {
          excalidraw: "^0.18.0",
          excaliOrganizer: "^1.0.0",
        },
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      // Generate ZIP blob and download
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_project.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Emit event
      eventBus.emit(InternalEventTypes.PROJECT_EXPORT_REQUEST, {
        project,
      });

      console.log("Project exported successfully as ZIP:", project.name);
    } catch (error) {
      console.error("Failed to export project:", error);
      alert("Failed to export project. Please try again.");
    }
    onClose();
  };

  const canvasCount = project.canvasIds?.length || 0;

  const menuStyles: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y,
    background: "var(--theme-bg-primary, #ffffff)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    borderRadius: "8px",
    boxShadow: "var(--theme-shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.1))",
    minWidth: "200px",
    padding: "8px 0",
    zIndex: 9999999,
    pointerEvents: "auto",
  };

  const menuItemStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    background: "none",
    border: "none",
    width: "100%",
    textAlign: "left",
    fontSize: "14px",
    color: "var(--theme-text-primary)",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  };

  const confirmModalStyles: React.CSSProperties = {
    // Removed manual positioning to rely on overlay's flex centering
    background: "var(--theme-bg-primary, #ffffff)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    borderRadius: "16px",
    boxShadow: "var(--theme-shadow-lg, 0 20px 40px rgba(0, 0, 0, 0.15))",
    padding: "0",
    width: "480px",
    maxWidth: "90vw",
    maxHeight: "90vh",
    overflow: "hidden",
    zIndex: 10000000,
    pointerEvents: "auto",
  };

  const overlayStyles: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.6)",
    zIndex: 9999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    backdropFilter: "blur(4px)",
  };

  return createPortal(
    <>
      <motion.div
        ref={menuRef}
        style={menuStyles}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
      >
        <button
          style={menuItemStyles}
          onClick={() => setRenameModalOpen(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--theme-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <Edit3 size={16} />
          Edit Project
          <span
            style={{
              marginLeft: "auto",
              fontSize: "12px",
              color: "var(--theme-text-secondary)",
            }}
          >
            F2
          </span>
        </button>

        <div
          style={{
            height: "1px",
            background: "var(--theme-border-secondary)",
            margin: "4px 0",
          }}
        />

        <button
          style={menuItemStyles}
          onClick={handleExport}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--theme-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <Download size={16} />
          Export Project
          <span
            style={{
              marginLeft: "auto",
              fontSize: "12px",
              color: "var(--theme-text-secondary)",
            }}
          >
            Ctrl+E
          </span>
        </button>

        <div
          style={{
            height: "1px",
            background: "var(--theme-border-secondary)",
            margin: "4px 0",
          }}
        />

        <button
          style={{
            ...menuItemStyles,
            color: "var(--theme-error, #ef4444)",
          }}
          onClick={() => setShowDeleteConfirm(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "var(--theme-error-bg, rgba(239, 68, 68, 0.1))";
            e.currentTarget.style.color = "var(--theme-error, #ef4444)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "var(--theme-error, #ef4444)";
          }}
        >
          <Trash2 size={16} />
          Delete Project
          <span
            style={{
              marginLeft: "auto",
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Delete
          </span>
        </button>
      </motion.div>

      {/* Edit Modal */}
      {isRenameModalOpen && (
        <ProjectEditModal
          project={project}
          onRename={handleRename}
          onClose={() => setRenameModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={overlayStyles}
          onClick={(e) => {
            // Only close if clicking directly on the overlay, not on the modal content
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowDeleteConfirm(false);
            }
          }}
          tabIndex={-1}
        >
          <motion.div
            ref={deleteModalRef}
            style={confirmModalStyles}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => {
              // Prevent modal content clicks from bubbling to overlay
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "24px 24px 0 24px",
              marginBottom: "20px"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "var(--theme-error-bg, rgba(239, 68, 68, 0.1))",
              }}>
                <AlertTriangle size={24} style={{ color: "var(--theme-error, #ef4444)" }} />
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "var(--theme-text-primary, #1f2937)",
                  lineHeight: "1.2"
                }}>
                  Delete Project
                </h3>
                <p style={{
                  margin: "4px 0 0 0",
                  fontSize: "14px",
                  color: "var(--theme-text-secondary, #6b7280)",
                  lineHeight: "1.4"
                }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: "0 24px", marginBottom: "24px" }}>
              <p style={{
                margin: "0 0 20px 0",
                fontSize: "16px",
                color: "var(--theme-text-primary, #1f2937)",
                lineHeight: "1.5"
              }}>
                Are you sure you want to delete "<strong style={{ color: "var(--theme-text-primary, #1f2937)" }}>{project.name}</strong>"?
              </p>

              {canvasCount > 0 && (
                <div style={{
                  padding: "20px",
                  borderRadius: "12px",
                  background: "var(--theme-bg-tertiary, #f8f9fa)",
                  border: "1px solid var(--theme-border-secondary, rgba(0, 0, 0, 0.08))"
                }}>
                  <p style={{
                    margin: "0 0 16px 0",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "var(--theme-text-primary, #1f2937)"
                  }}>
                    This project contains <strong>{canvasCount}</strong> canvas{canvasCount !== 1 ? 'es' : ''}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        cursor: "pointer",
                        padding: "12px",
                        borderRadius: "8px",
                        background: deleteCanvasAction === 'keep' ? "var(--theme-accent-primary, #6366f1)" : "var(--theme-bg-primary, #ffffff)",
                        color: deleteCanvasAction === 'keep' ? "white" : "var(--theme-text-primary, #1f2937)",
                        border: `2px solid ${deleteCanvasAction === 'keep' ? "var(--theme-accent-primary, #6366f1)" : "var(--theme-border-primary, rgba(0, 0, 0, 0.1))"}`,
                        transition: "all 0.15s ease"
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteCanvasAction('keep');
                      }}
                    >
                      <input
                        type="radio"
                        name="canvasAction"
                        value="keep"
                        checked={deleteCanvasAction === 'keep'}
                        onChange={(e) => {
                          e.stopPropagation();
                          setDeleteCanvasAction('keep');
                        }}
                        style={{
                          margin: "2px 0 0 0",
                          accentColor: deleteCanvasAction === 'keep' ? "white" : "var(--theme-accent-primary, #6366f1)",
                          cursor: "pointer",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "500", marginBottom: "4px" }}>
                          Keep canvases
                        </div>
                        <div style={{
                          fontSize: "13px",
                          opacity: deleteCanvasAction === 'keep' ? 0.9 : 0.7
                        }}>
                          Move all canvases to unorganized folder
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        cursor: "pointer",
                        padding: "12px",
                        borderRadius: "8px",
                        background: deleteCanvasAction === 'delete' ? "var(--theme-error, #ef4444)" : "var(--theme-bg-primary, #ffffff)",
                        color: deleteCanvasAction === 'delete' ? "white" : "var(--theme-text-primary, #1f2937)",
                        border: `2px solid ${deleteCanvasAction === 'delete' ? "var(--theme-error, #ef4444)" : "var(--theme-border-primary, rgba(0, 0, 0, 0.1))"}`,
                        transition: "all 0.15s ease"
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteCanvasAction('delete');
                      }}
                    >
                      <input
                        type="radio"
                        name="canvasAction"
                        value="delete"
                        checked={deleteCanvasAction === 'delete'}
                        onChange={(e) => {
                          e.stopPropagation();
                          setDeleteCanvasAction('delete');
                        }}
                        style={{
                          margin: "2px 0 0 0",
                          accentColor: deleteCanvasAction === 'delete' ? "white" : "var(--theme-error, #ef4444)",
                          cursor: "pointer",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "500", marginBottom: "4px" }}>
                          Delete all canvases
                        </div>
                        <div style={{
                          fontSize: "13px",
                          opacity: deleteCanvasAction === 'delete' ? 0.9 : 0.7
                        }}>
                          Permanently delete all {canvasCount} canvas{canvasCount !== 1 ? 'es' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
              padding: "0 24px 24px 24px",
              borderTop: "1px solid var(--theme-border-secondary, rgba(0, 0, 0, 0.08))",
              paddingTop: "20px"
            }}>
              <button
                style={{
                  padding: "12px 20px",
                  border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
                  borderRadius: "10px",
                  background: "var(--theme-bg-primary, #ffffff)",
                  color: "var(--theme-text-primary, #1f2937)",
                  fontSize: "15px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  minWidth: "80px"
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--theme-bg-hover, #f1f3f4)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--theme-bg-primary, #ffffff)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Cancel
              </button>

              <button
                style={{
                  padding: "12px 20px",
                  border: "1px solid var(--theme-error, #ef4444)",
                  borderRadius: "10px",
                  background: "var(--theme-error, #ef4444)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  minWidth: "140px",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)"
                }}
                onClick={handleDeleteConfirm}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dc2626";
                  e.currentTarget.style.borderColor = "#dc2626";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--theme-error, #ef4444)";
                  e.currentTarget.style.borderColor = "var(--theme-error, #ef4444)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.3)";
                }}
              >
                Delete Project
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>,
    document.body,
  );
}
