import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Folder,
  FileText,
  FolderPlus,
} from "lucide-react";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { SearchModal } from "./SearchModal";
import { ProjectModal } from "./ProjectModal";
import { ContextMenu } from "./ContextMenu";
import { UnifiedCanvas } from "../../shared/types";
import { canvasOperations } from "../../shared/unified-db";
import { v4 as uuidv4 } from "uuid";

interface Props {
  onNewCanvas: () => void;
  onCanvasSelect: (canvas: UnifiedCanvas) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

export function EnhancedAutoHidePanel({ onNewCanvas, onCanvasSelect }: Props) {
  const {
    state,
    dispatch,
    updatePanelSettings,
    getCanvasesForProject,
    getUnorganizedCanvases,
  } = useUnifiedState();
  const [isResizing, setIsResizing] = useState(false);
  const [showWidthIndicator, setShowWidthIndicator] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number>();
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Handle new project creation
  const handleNewProject = useCallback(() => {
    setShowProjectModal(true);
  }, []);

  // Handle panel toggle
  const handleTogglePanel = useCallback(() => {
    const newVisible = !state.isPanelVisible;
    dispatch({ type: "SET_PANEL_VISIBLE", payload: newVisible });
    eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
      isVisible: newVisible,
    });
  }, [state.isPanelVisible, dispatch]);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onNewCanvas,
    onNewProject: handleNewProject,
    onTogglePanel: handleTogglePanel,
  });

  // Enhanced canvas creation with better naming
  const handleNewCanvasEnhanced = useCallback(async () => {
    try {
      console.log("Creating new canvas...");

      const existingNames = state.canvases.map((c) => c.name);
      const baseName = "Untitled Canvas";
      let counter = 1;
      let finalName = baseName;

      // Find unique name
      while (existingNames.includes(finalName)) {
        finalName = `${baseName} ${counter}`;
        counter++;
      }

      const newCanvas: UnifiedCanvas = {
        id: uuidv4(),
        name: finalName,
        elements: [
          // Add a simple test element so we can verify loading works
          {
            id: uuidv4(),
            type: "text",
            x: 100,
            y: 100,
            width: 200,
            height: 50,
            angle: 0,
            strokeColor: "#000000",
            backgroundColor: "transparent",
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            text: `Welcome to ${finalName}!`,
            fontSize: 20,
            fontFamily: 1,
            textAlign: "left",
            verticalAlign: "top",
            containerId: null,
            originalText: `Welcome to ${finalName}!`,
            lineHeight: 1.25,
            // Required ExcalidrawElement properties
            version: 1,
            versionNonce: Math.floor(Math.random() * 2147483647),
            isDeleted: false,
            groupIds: [],
            frameId: null,
            roundness: null,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
          },
        ],
        excalidraw: [], // Backward compatibility
        appState: {
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
          width: window.innerWidth,
          height: window.innerHeight,
          viewBackgroundColor: "#ffffff",
          theme: "light" as const,
          selectedElementIds: {},
          editingGroupId: null,
          viewModeEnabled: false,
          currentItemFontSize: 20,
          currentItemStrokeColor: "#000000",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastModified: new Date().toISOString(), // Backward compatibility
        projectId: undefined,
      };

      console.log("New canvas created:", newCanvas);

      // Save to database first
      await canvasOperations.addCanvas(newCanvas);
      console.log("Canvas saved to database");

      // Update state
      dispatch({ type: "ADD_CANVAS", payload: newCanvas });
      dispatch({ type: "SET_SELECTED_CANVAS", payload: newCanvas.id });

      // Emit events
      eventBus.emit(InternalEventTypes.CANVAS_CREATED, newCanvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, newCanvas);

      // Call the original handler for any additional logic
      onNewCanvas();

      console.log("Canvas creation completed successfully");
    } catch (error) {
      console.error("Error creating new canvas:", error);
      // Show error to user
      dispatch({
        type: "SET_ERROR",
        payload:
          "Failed to create canvas: " +
          (error instanceof Error ? error.message : String(error)),
      });
      // Fallback to original handler
      onNewCanvas();
    }
  }, [state.canvases, dispatch, onNewCanvas]);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.8);
      if (state.panelWidth > maxAllowedWidth) {
        updatePanelSettings({ width: maxAllowedWidth });
      }
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [state.panelWidth, updatePanelSettings]);

  // Panel resize keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isPanelVisible || !state.isPanelPinned) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const delta = e.key === "ArrowLeft" ? -20 : 20;
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, state.panelWidth + delta),
        );
        updatePanelSettings({ width: newWidth });
        setShowWidthIndicator(true);
        setTimeout(() => setShowWidthIndicator(false), 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    state.isPanelVisible,
    state.isPanelPinned,
    state.panelWidth,
    updatePanelSettings,
  ]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    dispatch({ type: "SET_PANEL_VISIBLE", payload: true });
    eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
      isVisible: true,
    });
  };

  const handleMouseLeave = () => {
    if (!state.isPanelPinned && !isResizing) {
      timeoutRef.current = setTimeout(() => {
        dispatch({ type: "SET_PANEL_VISIBLE", payload: false });
        eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
          isVisible: false,
        });
      }, 300);
    }
  };

  const togglePin = () => {
    const newPinned = !state.isPanelPinned;
    dispatch({ type: "SET_PANEL_PINNED", payload: newPinned });
    updatePanelSettings({ isPinned: newPinned });

    if (newPinned) {
      dispatch({ type: "SET_PANEL_VISIBLE", payload: true });
      eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
        isVisible: true,
      });
    }

    eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
      isPinned: newPinned,
    });
  };

  // Mouse resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setShowWidthIndicator(true);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = state.panelWidth;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [state.panelWidth],
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeStartX.current;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, resizeStartWidth.current + deltaX),
      );
      dispatch({ type: "SET_PANEL_WIDTH", payload: newWidth });
    },
    [isResizing, dispatch],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    updatePanelSettings({ width: state.panelWidth });
    setTimeout(() => setShowWidthIndicator(false), 1000);
    eventBus.emit(InternalEventTypes.PANEL_WIDTH_CHANGED, {
      width: state.panelWidth,
    });
  }, [state.panelWidth, updatePanelSettings]);

  // Touch resize handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      setIsResizing(true);
      setShowWidthIndicator(true);
      resizeStartX.current = touch.clientX;
      resizeStartWidth.current = state.panelWidth;
    },
    [state.panelWidth],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isResizing) return;

      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - resizeStartX.current;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, resizeStartWidth.current + deltaX),
      );
      dispatch({ type: "SET_PANEL_WIDTH", payload: newWidth });
    },
    [isResizing, dispatch],
  );

  const handleTouchEnd = useCallback(() => {
    setIsResizing(false);
    updatePanelSettings({ width: state.panelWidth });
    setTimeout(() => setShowWidthIndicator(false), 1000);
  }, [state.panelWidth, updatePanelSettings]);

  // Event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isResizing,
    handleResizeMove,
    handleResizeEnd,
    handleTouchMove,
    handleTouchEnd,
  ]);

  const toggleProject = (projectId: string) => {
    dispatch({ type: "TOGGLE_PROJECT_COLLAPSED", payload: projectId });
    const collapsedArray = Array.from(state.collapsedProjects);
    updatePanelSettings({ collapsedProjects: collapsedArray });
  };

  const handleCanvasRightClick = (
    e: React.MouseEvent,
    canvas: UnifiedCanvas,
  ) => {
    e.preventDefault();
    dispatch({
      type: "SET_CONTEXT_MENU",
      payload: { x: e.clientX, y: e.clientY, canvas },
    });
  };

  const handleCanvasSelect = async (canvas: UnifiedCanvas) => {
    try {
      console.log("Selecting canvas:", canvas.name);

      dispatch({ type: "SET_SELECTED_CANVAS", payload: canvas.id });
      dispatch({ type: "SET_CURRENT_WORKING_CANVAS", payload: canvas.id });

      // Emit events
      eventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, canvas);

      // Call callback
      onCanvasSelect(canvas);

      console.log("Canvas selection completed");
    } catch (error) {
      console.error("Error selecting canvas:", error);
      dispatch({
        type: "SET_ERROR",
        payload:
          "Failed to select canvas: " +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Base styles for inline CSS (content script compatible)
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 999999,
    pointerEvents: "none",
  };

  const triggerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "10px",
    height: "100vh",
    pointerEvents: "all",
    zIndex: 1,
  };

  const panelStyle: React.CSSProperties = {
    position: "relative",
    width: `${state.panelWidth}px`,
    height: "100vh",
    background: "var(--theme-bg-primary, #ffffff)",
    borderRight: `1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))`,
    color: "var(--theme-text-primary, #1f2937)",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "14px",
    display: "flex",
    flexDirection: "column",
    pointerEvents: "all",
    boxShadow: "var(--theme-shadow-md, 0 0 20px rgba(0, 0, 0, 0.1))",
  };

  const resizeHandleStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    width: "4px",
    height: "100%",
    cursor: "col-resize",
    backgroundColor: "transparent",
    zIndex: 10,
  };

  const widthIndicatorStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    right: "10px",
    transform: "translateY(-50%)",
    background: "var(--theme-bg-tertiary)",
    color: "var(--theme-text-primary)",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    opacity: showWidthIndicator ? 1 : 0,
    transition: "opacity 0.2s ease",
    pointerEvents: "none",
    zIndex: 11,
  };

  return (
    <>
      <div style={containerStyle}>
        {/* Trigger area */}
        <div style={triggerStyle} onMouseEnter={handleMouseEnter} />

        {/* Panel */}
        <AnimatePresence>
          {(state.isPanelVisible || state.isPanelPinned) && (
            <motion.div
              ref={panelRef}
              style={panelStyle}
              initial={{ x: -state.panelWidth }}
              animate={{ x: 0 }}
              exit={{ x: -state.panelWidth }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Resize Handle */}
              <div
                style={resizeHandleStyle}
                onMouseDown={handleResizeStart}
                onTouchStart={handleTouchStart}
              />

              {/* Width Indicator */}
              <div style={widthIndicatorStyle}>{state.panelWidth}px</div>

              {/* Header */}
              <div
                style={{
                  padding: "16px",
                  borderBottom: `1px solid var(--theme-border-primary)`,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      margin: 0,
                      color: "var(--theme-text-primary)",
                    }}
                  >
                    Excalidraw
                  </h2>
                  <button
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--theme-text-secondary)",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      opacity: state.isPanelPinned ? 1 : 0.6,
                      transition: "opacity 0.2s ease",
                    }}
                    onClick={togglePin}
                    title={state.isPanelPinned ? "Unpin panel" : "Pin panel"}
                  >
                    {state.isPanelPinned ? (
                      <Pin size={16} />
                    ) : (
                      <PinOff size={16} />
                    )}
                  </button>
                </div>

                <button
                  style={{
                    background:
                      "linear-gradient(135deg, var(--theme-accent-primary, #6366f1), var(--theme-accent-secondary, #8b5cf6))",
                    color: "var(--theme-text-on-accent, #ffffff)",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    marginBottom: "8px",
                    transition: "transform 0.1s ease",
                  }}
                  onClick={handleNewCanvasEnhanced}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.98)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <Plus size={16} />
                  <span>New Canvas</span>
                </button>

                <button
                  style={{
                    background: "var(--theme-bg-active)",
                    color: "var(--theme-text-secondary)",
                    border: `1px solid var(--theme-border-primary)`,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    marginBottom: "8px",
                    transition: "background-color 0.2s ease",
                  }}
                  onClick={() => setShowProjectModal(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--theme-bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--theme-bg-active)";
                  }}
                >
                  <FolderPlus size={16} />
                  <span>New Project</span>
                </button>

                <button
                  style={{
                    background: "var(--theme-bg-active)",
                    color: "var(--theme-text-secondary)",
                    border: `1px solid var(--theme-border-primary)`,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    transition: "background-color 0.2s ease",
                  }}
                  onClick={() =>
                    dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: true })
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--theme-bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--theme-bg-active)";
                  }}
                >
                  <Search size={16} />
                  <span>Search canvases...</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      opacity: 0.7,
                      fontFamily: "monospace",
                    }}
                  >
                    ⌘P
                  </span>
                </button>
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: "0 16px 16px",
                }}
              >
                {/* Projects Section */}
                {state.projects.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        color: "var(--theme-text-secondary)",
                        marginBottom: "8px",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Projects
                    </div>

                    {state.projects.map((project) => {
                      const projectCanvases = getCanvasesForProject(project.id);
                      const isCollapsed = state.collapsedProjects.has(
                        project.id,
                      );

                      return (
                        <div key={project.id} style={{ marginBottom: "8px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "background-color 0.2s ease",
                            }}
                            onClick={() => toggleProject(project.id)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "var(--theme-bg-hover)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <div
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "2px",
                                backgroundColor: project.color,
                                flexShrink: 0,
                              }}
                            />
                            <Folder size={16} />
                            <span
                              style={{
                                flex: 1,
                                fontWeight: "500",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {project.name}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--theme-text-secondary)",
                                flexShrink: 0,
                              }}
                            >
                              {projectCanvases.length}
                            </span>
                          </div>

                          <AnimatePresence>
                            {!isCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: "hidden" }}
                              >
                                {projectCanvases.map((canvas) => (
                                  <div
                                    key={canvas.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      padding: "6px 8px",
                                      marginLeft: "20px",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      transition: "background-color 0.2s ease",
                                      backgroundColor:
                                        state.selectedCanvasId === canvas.id
                                          ? "var(--theme-bg-active)"
                                          : "transparent",
                                    }}
                                    onClick={() => handleCanvasSelect(canvas)}
                                    onContextMenu={(e) =>
                                      handleCanvasRightClick(e, canvas)
                                    }
                                    onMouseEnter={(e) => {
                                      if (
                                        state.selectedCanvasId !== canvas.id
                                      ) {
                                        e.currentTarget.style.background =
                                          "var(--theme-bg-hover)";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (
                                        state.selectedCanvasId !== canvas.id
                                      ) {
                                        e.currentTarget.style.background =
                                          "transparent";
                                      }
                                    }}
                                  >
                                    <FileText size={12} />
                                    <span
                                      style={{
                                        flex: 1,
                                        fontSize: "13px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {canvas.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "var(--theme-text-secondary)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {formatDate(
                                        canvas.updatedAt || canvas.createdAt,
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent Canvases Section */}
                <div style={{ marginBottom: "24px" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      color: "var(--theme-text-secondary)",
                      marginBottom: "8px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Recent
                  </div>

                  {getUnorganizedCanvases().length > 0 ? (
                    getUnorganizedCanvases()
                      .sort(
                        (a, b) =>
                          new Date(b.updatedAt || b.createdAt).getTime() -
                          new Date(a.updatedAt || a.createdAt).getTime(),
                      )
                      .map((canvas) => (
                        <div
                          key={canvas.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "background-color 0.2s ease",
                            backgroundColor:
                              state.selectedCanvasId === canvas.id
                                ? "var(--theme-bg-active)"
                                : "transparent",
                          }}
                          onClick={() => handleCanvasSelect(canvas)}
                          onContextMenu={(e) =>
                            handleCanvasRightClick(e, canvas)
                          }
                          onMouseEnter={(e) => {
                            if (state.selectedCanvasId !== canvas.id) {
                              e.currentTarget.style.background =
                                "var(--theme-bg-hover)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (state.selectedCanvasId !== canvas.id) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          <FileText size={16} />
                          <span
                            style={{
                              flex: 1,
                              fontWeight: "500",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {canvas.name}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--theme-text-secondary)",
                              flexShrink: 0,
                            }}
                          >
                            {formatDate(canvas.updatedAt || canvas.createdAt)}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "32px 16px",
                        color: "var(--theme-text-secondary)",
                      }}
                    >
                      <FileText
                        size={48}
                        style={{ opacity: 0.5, marginBottom: "12px" }}
                      />
                      <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                        No canvases yet
                      </div>
                      <div style={{ fontSize: "12px" }}>
                        Create your first canvas to get started
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {state.isSearchModalOpen && <SearchModal />}
      </AnimatePresence>

      <AnimatePresence>
        {showProjectModal && (
          <ProjectModal onClose={() => setShowProjectModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.contextMenu && (
          <ContextMenu
            x={state.contextMenu.x}
            y={state.contextMenu.y}
            canvas={state.contextMenu.canvas}
            onClose={() =>
              dispatch({ type: "SET_CONTEXT_MENU", payload: null })
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}
