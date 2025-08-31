import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
// Pin and PinOff imports moved to PanelHeader component
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { sortProjectsByActivity, PROJECT_SORT_CONSTANTS } from "../../shared/utils";
import {
  useKeyboardShortcuts,
  getExtensionShortcuts,
} from "../hooks/useKeyboardShortcuts";
import { SearchModal } from "./SearchModal";
import { HelpOverlay } from "./HelpOverlay";
import CanvasDeleteModal from "./CanvasDeleteModal";
import { RenameModal } from "./RenameModal";
import { ProjectFormModal } from "./ProjectFormModal";
import { ContextMenu } from "./ContextMenu";
import { ProjectContextMenu } from "./ProjectContextMenu";
import { PanelHeader } from "./PanelHeader";
import { PanelFooter } from "./PanelFooter";
import { ProjectSection } from "./ProjectSection";
import { CanvasSection } from "./CanvasSection";
import { 
  ComponentErrorBoundary, 
  PanelErrorFallback, 
  ProjectSectionErrorFallback, 
  CanvasSectionErrorFallback 
} from "./ErrorBoundary";
import { UnifiedCanvas, UnifiedProject } from "../../shared/types";
import { canvasOperations, settingsOperations } from "../../shared/unified-db";
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
    removeCanvas,
    saveCanvas,
  } = useUnifiedState();
  const [isResizing, setIsResizing] = useState(false);
  const [showWidthIndicator, setShowWidthIndicator] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [isMouseOverPanel, setIsMouseOverPanel] = useState(false);
  const [hoveredProject, setHoveredProject] = useState<UnifiedProject | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showAllProjects, setShowAllProjects] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number>();
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Stabilize the canvas count function for memoization
  const getCanvasCount = useCallback(
    (projectId: string) => getCanvasesForProject(projectId).length,
    [getCanvasesForProject]
  );

  // Memoized project sorting for performance
  const { sortedProjects, projectsToShow, hasMoreProjects } = useMemo(() => {
    const sorted = sortProjectsByActivity(state.projects, getCanvasCount);

    const toShow = showAllProjects
      ? sorted
      : sorted.slice(0, PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT);
    const hasMore = sorted.length > PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT;

    return {
      sortedProjects: sorted,
      projectsToShow: toShow,
      hasMoreProjects: hasMore,
    };
  }, [state.projects, showAllProjects, getCanvasCount]);

  // Handle new project creation
  const handleNewProject = useCallback(() => {
    setShowProjectModal(true);
  }, []);

  // Handle panel toggle with VS Code-like pin/unpin behavior
  const handleTogglePanel = useCallback(() => {
    // If panel is hidden, show and pin it
    if (!state.isPanelVisible) {
      dispatch({ type: "SET_PANEL_VISIBLE", payload: true });
      dispatch({ type: "SET_PANEL_PINNED", payload: true });
      updatePanelSettings({ isPinned: true });

      eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
        isVisible: true,
      });
      eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
        isPinned: true,
      });
    }
    // If panel is visible and pinned, unpin it (allowing auto-hide)
    else if (state.isPanelVisible && state.isPanelPinned) {
      dispatch({ type: "SET_PANEL_PINNED", payload: false });
      updatePanelSettings({ isPinned: false });

      eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
        isPinned: false,
      });

      // If mouse is not over panel, start auto-hide timer
      if (!isMouseOverPanel) {
        timeoutRef.current = setTimeout(() => {
          dispatch({ type: "SET_PANEL_VISIBLE", payload: false });
          eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
            isVisible: false,
          });
        }, 300);
      }
    }
    // If panel is visible but not pinned, pin it
    else if (state.isPanelVisible && !state.isPanelPinned) {
      dispatch({ type: "SET_PANEL_PINNED", payload: true });
      updatePanelSettings({ isPinned: true });

      eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
        isPinned: true,
      });

      // Clear any pending auto-hide timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [state.isPanelVisible, state.isPanelPinned, isMouseOverPanel, dispatch, updatePanelSettings]);

  const shortcuts = getExtensionShortcuts().shortcuts;

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
            width: 250,
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
        projectId: undefined,
      };

      console.log("New canvas created:", newCanvas);

      // Save to database first
      await canvasOperations.addCanvas(newCanvas);
      console.log("Canvas saved to database");

      // Update state
      dispatch({ type: "ADD_CANVAS", payload: newCanvas });
      dispatch({ type: "SET_SELECTED_CANVAS", payload: newCanvas.id });

      // Emit events (let orchestrator handle loading)
      eventBus.emit(InternalEventTypes.CANVAS_CREATED, newCanvas);
      eventBus.emit(InternalEventTypes.CANVAS_SELECTED, newCanvas);

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

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onNewCanvas,
    onNewProject: handleNewProject,
    onTogglePanel: handleTogglePanel,
  });

  // Listen for new canvas requests
  useEffect(() => {
    const unsubscribe = eventBus.on(InternalEventTypes.REQUEST_NEW_CANVAS, () => {
      handleNewCanvasEnhanced();
    });

    return unsubscribe;
  }, [handleNewCanvasEnhanced]);

  // Canvas delete handlers
  const handleConfirmCanvasDelete = useCallback(async () => {
    if (!state.canvasToDelete) return;

    try {
      // Create replacement function that uses the event bus
      const createReplacementCanvas = async () => {
        await eventBus.emit(InternalEventTypes.REQUEST_NEW_CANVAS, null);
      };

      // Use existing removeCanvas logic with event-based replacement
      await removeCanvas(state.canvasToDelete.id, createReplacementCanvas);

      // Emit deletion event for any listeners
      eventBus.emit(InternalEventTypes.CANVAS_DELETED, state.canvasToDelete);

      // Close modal
      dispatch({ type: "SET_CANVAS_DELETE_MODAL_OPEN", payload: false });
      dispatch({ type: "SET_CANVAS_TO_DELETE", payload: null });
    } catch (error) {
      console.error("Failed to delete canvas:", error);
      // Close modal even on error to avoid stuck state
      dispatch({ type: "SET_CANVAS_DELETE_MODAL_OPEN", payload: false });
      dispatch({ type: "SET_CANVAS_TO_DELETE", payload: null });
      // Show error
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to delete canvas. Please try again.",
      });
    }
  }, [state.canvasToDelete, removeCanvas, dispatch]);

  const handleCancelCanvasDelete = useCallback(() => {
    dispatch({ type: "SET_CANVAS_DELETE_MODAL_OPEN", payload: false });
    dispatch({ type: "SET_CANVAS_TO_DELETE", payload: null });
  }, [dispatch]);

  // Canvas rename handlers
  const handleCanvasRename = useCallback(async (newName: string) => {
    if (!state.canvasToRename) return;

    try {
      const updatedCanvas = {
        ...state.canvasToRename,
        name: newName.trim(),
        updatedAt: new Date(),
      };

      await saveCanvas(updatedCanvas);
      eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);

      // Close the modal
      dispatch({ type: "SET_RENAME_MODAL_OPEN", payload: false });
      dispatch({ type: "SET_CANVAS_TO_RENAME", payload: null });
    } catch (error) {
      console.error("Failed to rename canvas:", error);
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to rename canvas. Please try again.",
      });
    }
  }, [state.canvasToRename, saveCanvas, dispatch]);

  const handleCancelCanvasRename = useCallback(() => {
    dispatch({ type: "SET_RENAME_MODAL_OPEN", payload: false });
    dispatch({ type: "SET_CANVAS_TO_RENAME", payload: null });
  }, [dispatch]);

  // Handle window resize and escape key for modals
  useEffect(() => {
    const handleWindowResize = () => {
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.8);
      if (state.panelWidth > maxAllowedWidth) {
        updatePanelSettings({ width: maxAllowedWidth });
      }
    };

    const handleEscape = () => {
      if (showProjectModal) {
        setShowProjectModal(false);
      }
    };

    window.addEventListener("resize", handleWindowResize);
    eventBus.on(InternalEventTypes.ESCAPE_PRESSED, handleEscape);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      eventBus.off(InternalEventTypes.ESCAPE_PRESSED, handleEscape);
    };
  }, [state.panelWidth, updatePanelSettings, showProjectModal]);

  // Monitor context menu state changes to resume auto-hide when menus close
  useEffect(() => {
    // If context menus open, clear any pending auto-hide timer
    if ((state.contextMenu || state.projectContextMenu) && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // If context menus were just closed and mouse is not over panel, start auto-hide timer
    if (!state.contextMenu && !state.projectContextMenu && !state.isPanelPinned && !isResizing && state.isPanelVisible && !isMouseOverPanel) {
      // Clear any existing timeout first
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Start auto-hide timer (same delay as mouse leave)
      timeoutRef.current = setTimeout(() => {
        dispatch({ type: "SET_PANEL_VISIBLE", payload: false });
        eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
          isVisible: false,
        });
      }, 300);
    }
  }, [state.contextMenu, state.projectContextMenu, state.isPanelPinned, isResizing, state.isPanelVisible, isMouseOverPanel, dispatch]);

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
    setIsMouseOverPanel(true);
    dispatch({ type: "SET_PANEL_VISIBLE", payload: true });
    eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
      isVisible: true,
    });
  };

  const handleMouseLeave = () => {
    setIsMouseOverPanel(false);
    // Don't auto-hide if panel is pinned, currently resizing, or any context menu is open
    if (!state.isPanelPinned && !isResizing && !state.contextMenu && !state.projectContextMenu) {
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
      if (!touch) return;
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
      if (!touch) return;
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

  const toggleProject = useCallback(async (projectId: string) => {
    // First update the local state
    dispatch({ type: "TOGGLE_PROJECT_COLLAPSED", payload: projectId });

    // Calculate what the new state will be
    const newCollapsed = new Set(state.collapsedProjects);
    if (newCollapsed.has(projectId)) {
      newCollapsed.delete(projectId);
    } else {
      newCollapsed.add(projectId);
    }

    // Save to persistent storage (but don't dispatch again to avoid conflicts)
    try {
      await settingsOperations.setSetting(
        "collapsedProjects",
        Array.from(newCollapsed)
      );
    } catch (error) {
      console.error("Failed to save collapsed projects:", error);
    }
  }, [state.collapsedProjects, dispatch]);

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

  const handleProjectRightClick = (
    e: React.MouseEvent,
    project: UnifiedProject,
  ) => {
    e.preventDefault();
    dispatch({
      type: "SET_PROJECT_CONTEXT_MENU",
      payload: { x: e.clientX, y: e.clientY, project },
    });
  };

  const handleCanvasSelect = async (canvas: UnifiedCanvas) => {
    try {
      console.log("Selecting canvas:", canvas.name);

      dispatch({ type: "SET_SELECTED_CANVAS", payload: canvas.id });

      // Emit selection only; orchestrator will save-before-switch and load
      eventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);

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
              <ComponentErrorBoundary 
                fallback={PanelErrorFallback}
                componentName="PanelHeader"
              >
                <PanelHeader
                  isPanelPinned={state.isPanelPinned}
                  onTogglePin={togglePin}
                  onNewCanvas={handleNewCanvasEnhanced}
                  onNewProject={() => setShowProjectModal(true)}
                  onSearchOpen={() => dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: true })}
                  shortcuts={shortcuts}
                />
              </ComponentErrorBoundary>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: "0 16px 16px",
                }}
              >
                {/* Projects Section */}
                <ComponentErrorBoundary 
                  fallback={ProjectSectionErrorFallback}
                  componentName="ProjectSection"
                >
                  <ProjectSection
                    projects={state.projects}
                    sortedProjects={sortedProjects}
                    projectsToShow={projectsToShow}
                    hasMoreProjects={hasMoreProjects}
                    showAllProjects={showAllProjects}
                    onShowAllProjectsToggle={() => setShowAllProjects(!showAllProjects)}
                    collapsedProjects={state.collapsedProjects}
                    selectedCanvasId={state.selectedCanvasId}
                    getCanvasesForProject={getCanvasesForProject}
                    onToggleProject={toggleProject}
                    onProjectRightClick={handleProjectRightClick}
                    onCanvasSelect={handleCanvasSelect}
                    onCanvasRightClick={handleCanvasRightClick}
                    formatDate={formatDate}
                    hoveredProject={hoveredProject}
                    onProjectHover={(project, position) => {
                      setHoveredProject(project);
                      if (position) {
                        setTooltipPosition(position);
                      }
                    }}
                  />
                </ComponentErrorBoundary>

                {/* Recent Canvases Section */}
                <ComponentErrorBoundary 
                  fallback={CanvasSectionErrorFallback}
                  componentName="CanvasSection"
                >
                  <CanvasSection
                    unorganizedCanvases={getUnorganizedCanvases()}
                    selectedCanvasId={state.selectedCanvasId}
                    onCanvasSelect={handleCanvasSelect}
                    onCanvasRightClick={handleCanvasRightClick}
                    formatDate={formatDate}
                  />
                </ComponentErrorBoundary>
              </div>

              {/* Footer */}
              <ComponentErrorBoundary 
                fallback={PanelErrorFallback}
                componentName="PanelFooter"
              >
                <PanelFooter
                  onHelpOpen={() => dispatch({ type: "SET_HELP_MODAL_OPEN", payload: true })}
                />
              </ComponentErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {state.isSearchModalOpen && <SearchModal />}
        {state.isHelpModalOpen && <HelpOverlay />}
        {state.isCanvasDeleteModalOpen && state.canvasToDelete && (
          <CanvasDeleteModal
            canvas={state.canvasToDelete}
            onConfirm={handleConfirmCanvasDelete}
            onCancel={handleCancelCanvasDelete}
          />
        )}
        {state.isRenameModalOpen && state.canvasToRename && (
          <RenameModal
            currentName={state.canvasToRename.name}
            onRename={handleCanvasRename}
            onClose={handleCancelCanvasRename}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProjectModal && (
          <ProjectFormModal
            mode="create"
            onClose={() => setShowProjectModal(false)}
          />
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

      <AnimatePresence>
        {state.projectContextMenu && (
          <ProjectContextMenu
            x={state.projectContextMenu.x}
            y={state.projectContextMenu.y}
            project={state.projectContextMenu.project}
            onClose={() =>
              dispatch({ type: "SET_PROJECT_CONTEXT_MENU", payload: null })
            }
          />
        )}
      </AnimatePresence>

      {/* Project Description Tooltip */}
      <AnimatePresence>
        {hoveredProject?.description && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed",
              left: Math.min(tooltipPosition.x, window.innerWidth - 420),
              top: tooltipPosition.y,
              transform: "translateY(-50%)",
              background: "var(--theme-bg-primary)",
              border: "1px solid var(--theme-border-primary)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              color: "var(--theme-text-primary)",
              minWidth: "200px",
              maxWidth: "400px",
              zIndex: 1000000,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              pointerEvents: "none",
            }}
          >
            {hoveredProject.description}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
