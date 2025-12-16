import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import {
  sortProjectsByActivity,
  PROJECT_SORT_CONSTANTS,
  makeUniqueFilename,
  makeUniquePathSegment,
} from "../../shared/utils";
import {
  useKeyboardShortcuts,
  getExtensionShortcuts,
} from "../hooks/useKeyboardShortcuts";
import { useEventBusListener } from "../hooks/useEventBusListener";
import { usePanelVisibility, usePanelResize } from "../hooks/usePanelLayout";
import { PANEL_CONSTANTS } from "../../shared/constants";
import { createDefaultCanvas } from "../../shared/canvasFactory";
import { backupOperations, canvasOperations, settingsOperations } from "../../shared/unified-db";
import JSZip from "jszip";
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
import { ImportAllModal } from "./ImportAllModal";
import { ExportAllModal } from "./ExportAllModal";
import {
  detectConflicts,
  importBackupZip,
  parseBackupZip,
  type ConflictReport,
  type ImportMode,
  type ImportResult,
  type ParsedBackupZip,
} from "../services/backupImportAll";

interface Props {
  onNewCanvas: () => void;
  onCanvasSelect: (canvas: UnifiedCanvas) => void;
}

export function EnhancedAutoHidePanel({ onNewCanvas, onCanvasSelect }: Props) {
  const {
    state,
    dispatch,
    updatePanelSettings,
    loadInitialData,
    getCanvasesForProject,
    getUnorganizedCanvases,
    removeCanvas,
    saveCanvas,
  } = useUnifiedState();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [hoveredProject, setHoveredProject] = useState<UnifiedProject | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportAllModalOpen, setIsExportAllModalOpen] = useState(false);
  const [exportPhase, setExportPhase] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [exportProgressMessage, setExportProgressMessage] = useState<string | undefined>(undefined);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const [exportCounts, setExportCounts] = useState<{ canvases: number; projects: number; settings: number } | undefined>(
    undefined,
  );
  const [isImportAllModalOpen, setIsImportAllModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importPhase, setImportPhase] = useState<
    "idle" | "parsing" | "ready" | "importing" | "done" | "error"
  >("idle");
  const [importFileName, setImportFileName] = useState<string | undefined>(undefined);
  const [importParsed, setImportParsed] = useState<ParsedBackupZip | undefined>(undefined);
  const [importConflicts, setImportConflicts] = useState<ConflictReport | undefined>(undefined);
  const [importProgressMessage, setImportProgressMessage] = useState<string | undefined>(undefined);
  const [importResult, setImportResult] = useState<ImportResult | undefined>(undefined);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const isImportingAll = importPhase === "parsing" || importPhase === "importing";

  const yieldToBrowser = () =>
    new Promise((resolve) => setTimeout(resolve, 0));

  const toExcalidrawFile = (canvas: UnifiedCanvas) => ({
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: canvas.elements || [],
    appState:
      canvas.appState || {
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
    metadata: {
      id: canvas.id,
      name: canvas.name,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
      projectId: canvas.projectId,
    },
  });

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

  const shortcuts = getExtensionShortcuts().shortcuts;

  const {
    isResizing,
    showWidthIndicator,
    handleMouseResizeStart,
    handleTouchResizeStart,
    handleKeyboardResize,
  } = usePanelResize({
    panelWidth: state.panelWidth,
    dispatch,
    updatePanelSettings,
  });

  const {
    handleMouseEnter,
    handleMouseLeave,
    handleTogglePanel,
  } = usePanelVisibility({
    isPanelPinned: state.isPanelPinned,
    isPanelVisible: state.isPanelVisible,
    contextMenuOpen: Boolean(state.contextMenu),
    projectContextMenuOpen: Boolean(state.projectContextMenu),
    dispatch,
    updatePanelSettings,
    suppressAutoHide: isResizing || isExportingAll || isImportingAll,
  });

  // Enhanced canvas creation with shared defaults
  const handleNewCanvasEnhanced = useCallback(async () => {
    try {
      const newCanvas = createDefaultCanvas({
        existingNames: state.canvases.map((c) => c.name),
        width: window.innerWidth,
        height: window.innerHeight,
        theme: state.theme ?? "light",
      });

      await canvasOperations.addCanvas(newCanvas);
      dispatch({ type: "ADD_CANVAS", payload: newCanvas });
      dispatch({ type: "SET_SELECTED_CANVAS", payload: newCanvas.id });

      eventBus.emit(InternalEventTypes.CANVAS_CREATED, newCanvas);
      eventBus.emit(InternalEventTypes.CANVAS_SELECTED, newCanvas);

      onNewCanvas();
    } catch (error) {
      console.error("Error creating new canvas:", error);
      dispatch({
        type: "SET_ERROR",
        payload:
          "Failed to create canvas: " +
          (error instanceof Error ? error.message : String(error)),
      });
      onNewCanvas();
    }
  }, [state.canvases, state.theme, dispatch, onNewCanvas]);

  const handleExportAll = useCallback(async () => {
    try {
      setIsExportingAll(true);
      setIsExportAllModalOpen(true);
      setExportPhase("exporting");
      setExportErrorMessage(null);
      setExportProgressMessage("Collecting data…");
      const exportData = await backupOperations.exportAllData();
      const zip = new JSZip();
      const timestamp = new Date().toISOString();

      // Yield before heavy work
      await yieldToBrowser();

      setExportCounts({
        canvases: exportData.canvases.length,
        projects: exportData.projects.length,
        settings: exportData.settings?.length ?? 0,
      });

      setExportProgressMessage("Writing manifest…");
      const projectById = new Map(exportData.projects.map((p) => [p.id, p]));
      const canvasById = new Map(exportData.canvases.map((c) => [c.id, c]));

      const projectCanvasIdsByProjectId = new Map<string, Set<string>>();
      const canvasesInAnyProject = new Set<string>();

      exportData.projects.forEach((project) => {
        const canvasIds = new Set<string>(project.canvasIds ?? []);
        projectCanvasIdsByProjectId.set(project.id, canvasIds);
        canvasIds.forEach((id) => canvasesInAnyProject.add(id));
      });

      exportData.canvases.forEach((canvas) => {
        const projectId = canvas.projectId;
        if (!projectId) return;
        if (!projectById.has(projectId)) return;

        const canvasIds = projectCanvasIdsByProjectId.get(projectId) ?? new Set<string>();
        canvasIds.add(canvas.id);
        projectCanvasIdsByProjectId.set(projectId, canvasIds);
        canvasesInAnyProject.add(canvas.id);
      });

      // Root manifest
      zip.file(
        "manifest.json",
        JSON.stringify(
          {
            exportVersion: "1.1.0",
            exportedAt: timestamp,
            canvasCount: exportData.canvases.length,
            projectCount: exportData.projects.length,
            settingsCount: exportData.settings?.length ?? 0,
            format: "zip",
            source: "Excali Organizer",
          },
          null,
          2,
        ),
      );

      // Settings + raw tables
      setExportProgressMessage("Adding raw tables…");
      zip.file("canvases.json", JSON.stringify(exportData.canvases, null, 2));
      zip.file("projects.json", JSON.stringify(exportData.projects, null, 2));
      zip.file("settings.json", JSON.stringify(exportData.settings ?? [], null, 2));

      const canvasesFolder = zip.folder("canvases");
      if (!canvasesFolder) throw new Error("Unable to create canvases folder");

      // Export each canvas as .excalidraw (single canvas download parity)
      setExportProgressMessage("Packaging canvases…");
      const usedRootCanvasFilenames = new Set<string>();
      exportData.canvases
        .filter((canvas) => {
          if (canvas.projectId && projectById.has(canvas.projectId)) return false;
          return !canvasesInAnyProject.has(canvas.id);
        })
        .forEach((canvas) => {
          const filename = makeUniqueFilename(
            usedRootCanvasFilenames,
            canvas.name || canvas.id,
            "excalidraw",
          );
          canvasesFolder.file(filename, JSON.stringify(toExcalidrawFile(canvas), null, 2));
        });

      // Yield again before project packaging
      await yieldToBrowser();

      const projectsFolder = zip.folder("projects");
      if (!projectsFolder) throw new Error("Unable to create projects folder");

      setExportProgressMessage("Packaging projects…");
      const usedProjectFolderNames = new Set<string>();
      exportData.projects.forEach((project: UnifiedProject) => {
        const projectFolderName = makeUniquePathSegment(
          usedProjectFolderNames,
          project.name || project.id,
        );
        const projectFolder = projectsFolder.folder(projectFolderName);
        if (!projectFolder) return;

        const projectCanvasIds = projectCanvasIdsByProjectId.get(project.id) ?? new Set<string>();
        const projectCanvases = Array.from(projectCanvasIds)
          .map((id) => canvasById.get(id))
          .filter((canvas): canvas is UnifiedCanvas => Boolean(canvas));

        const projectMetadata = {
          id: project.id,
          name: project.name,
          description: project.description || "",
          color: project.color,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          canvasCount: projectCanvases.length,
        };

        projectFolder.file("project.json", JSON.stringify(projectMetadata, null, 2));

        const projectCanvasFolder = projectFolder.folder("canvases");
        if (projectCanvasFolder) {
          const usedProjectCanvasFilenames = new Set<string>();
          projectCanvases.forEach((canvas) => {
            const filename = makeUniqueFilename(
              usedProjectCanvasFilenames,
              canvas.name || canvas.id,
              "excalidraw",
            );
            projectCanvasFolder.file(
              filename,
              JSON.stringify(toExcalidrawFile(canvas), null, 2),
            );
          });
        }

        const manifest = {
          exportVersion: "1.0.0",
          exportedAt: timestamp,
          exportedBy: "Excali Organizer Extension",
          projectName: project.name,
          canvasCount: projectCanvases.length,
          format: "zip",
          compatibility: {
            excalidraw: "^0.18.0",
            excaliOrganizer: "^1.0.0",
          },
        };
        projectFolder.file("manifest.json", JSON.stringify(manifest, null, 2));
      });

      // Final yield before generating blob
      await yieldToBrowser();

      setExportProgressMessage("Compressing zip…");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      setExportProgressMessage("Starting download…");
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `excali-org-backup-${timestamp.slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgressMessage(undefined);
      setExportPhase("done");
    } catch (error) {
      console.error("Failed to export all data:", error);
      setExportPhase("error");
      setExportProgressMessage(undefined);
      setExportErrorMessage(error instanceof Error ? error.message : "Export failed");
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to export data. Please try again.",
      });
    } finally {
      setIsExportingAll(false);
    }
  }, [dispatch]);

  const handleExportAllClose = useCallback(() => {
    if (exportPhase === "exporting") return;
    setIsExportAllModalOpen(false);
  }, [exportPhase]);

  const resetExportState = useCallback(() => {
    if (exportPhase === "exporting") return;
    setExportPhase("idle");
    setExportProgressMessage(undefined);
    setExportErrorMessage(null);
    setExportCounts(undefined);
  }, [exportPhase]);

  const resetImportState = useCallback(() => {
    setImportPhase("idle");
    setImportFileName(undefined);
    setImportParsed(undefined);
    setImportConflicts(undefined);
    setImportProgressMessage(undefined);
    setImportResult(undefined);
    setImportErrorMessage(null);
  }, []);

  const handleImportAllClick = useCallback(() => {
    resetImportState();
    setImportMode("merge");
    setIsImportAllModalOpen(true);
  }, [resetImportState]);

  const handleImportAllClose = useCallback(() => {
    if (isImportingAll) return;
    setIsImportAllModalOpen(false);
  }, [isImportingAll]);

  const handleImportAllPickFile = useCallback(() => {
    if (isImportingAll) return;
    importInputRef.current?.click();
  }, [isImportingAll]);

  const handleImportAllModeChange = useCallback(
    async (mode: ImportMode) => {
      if (isImportingAll) return;
      setImportMode(mode);
      setImportResult(undefined);
      setImportErrorMessage(null);

      if (!importParsed) {
        setImportConflicts(undefined);
        return;
      }

      if (mode === "replace") {
        setImportConflicts(undefined);
        setImportPhase("ready");
        return;
      }

      try {
        setImportPhase("parsing");
        setImportProgressMessage("Checking for conflicts…");
        const nextConflicts = await detectConflicts(importParsed, setImportProgressMessage);
        setImportConflicts(nextConflicts);
        setImportProgressMessage(undefined);
        setImportPhase("ready");
      } catch (error) {
        setImportPhase("error");
        setImportErrorMessage(error instanceof Error ? error.message : "Failed to detect conflicts");
      }
    },
    [importParsed, isImportingAll],
  );

  const startImport = useCallback(async (override?: {
    parsed?: ParsedBackupZip;
    mode?: ImportMode;
    conflicts?: ConflictReport;
  }) => {
    const effectiveParsed = override?.parsed ?? importParsed;
    const effectiveMode = override?.mode ?? importMode;
    const effectiveConflicts = override?.conflicts ?? importConflicts;

    if (!effectiveParsed) return;
    if (effectiveMode === "merge" && !effectiveConflicts) return;

    try {
      setImportPhase("importing");
      setImportErrorMessage(null);
      setImportResult(undefined);
      const result = await importBackupZip({
        data: effectiveParsed,
        mode: effectiveMode,
        onProgress: setImportProgressMessage,
      });
      setImportProgressMessage("Refreshing…");
      await loadInitialData();
      setImportProgressMessage(undefined);
      setImportResult(result);
      setImportPhase("done");
    } catch (error) {
      console.error("Failed to import all data:", error);
      setImportPhase("error");
      setImportProgressMessage(undefined);
      setImportErrorMessage(error instanceof Error ? error.message : "Import failed");
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to import backup. Please try again.",
      });
    }
  }, [dispatch, importConflicts, importMode, importParsed, loadInitialData]);

  const handleImportAllFile = useCallback(
    async (file: File) => {
      try {
        setImportErrorMessage(null);
        setImportResult(undefined);
        setImportFileName(file.name);
        setImportPhase("parsing");

        const parsed = await parseBackupZip(file, setImportProgressMessage);
        setImportParsed(parsed);

        if (importMode === "merge") {
          const nextConflicts = await detectConflicts(parsed, setImportProgressMessage);
          setImportConflicts(nextConflicts);
          setImportProgressMessage(undefined);
          setImportPhase("ready");

          const hasConflicts =
            nextConflicts.canvasIds.length > 0 ||
            nextConflicts.projectIds.length > 0 ||
            nextConflicts.projectNames.length > 0 ||
            nextConflicts.settingKeys.length > 0;

          if (!hasConflicts) {
            await startImport({ parsed, mode: importMode, conflicts: nextConflicts });
          }
        } else {
          setImportConflicts(undefined);
          setImportProgressMessage(undefined);
          setImportPhase("ready");
        }
      } catch (error) {
        console.error("Failed to parse import zip:", error);
        setImportPhase("error");
        setImportProgressMessage(undefined);
        setImportErrorMessage(error instanceof Error ? error.message : "Import failed");
      }
    },
    [importMode, startImport],
  );

  const handleImportAllFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await handleImportAllFile(file);
    },
    [handleImportAllFile],
  );

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onNewCanvas,
    onNewProject: handleNewProject,
    onTogglePanel: handleTogglePanel,
  });

  const handleRequestNewCanvas = useCallback(() => {
    void handleNewCanvasEnhanced();
  }, [handleNewCanvasEnhanced]);

  useEventBusListener(InternalEventTypes.REQUEST_NEW_CANVAS, handleRequestNewCanvas);

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
      const maxAllowedWidth = Math.min(PANEL_CONSTANTS.MAX_WIDTH, window.innerWidth * 0.8);
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
        handleKeyboardResize(e.key === "ArrowLeft" ? "left" : "right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    state.isPanelVisible,
    state.isPanelPinned,
    handleKeyboardResize,
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
      <input
        ref={importInputRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: "none" }}
        onChange={handleImportAllFileSelected}
      />
      <ImportAllModal
        isOpen={isImportAllModalOpen}
        phase={importPhase}
        mode={importMode}
        fileName={importFileName}
        parsed={importParsed}
        conflicts={importConflicts}
        progressMessage={importProgressMessage}
        result={importResult}
        errorMessage={importErrorMessage}
        onClose={handleImportAllClose}
        onPickFile={handleImportAllPickFile}
        onFileSelected={handleImportAllFile}
        onModeChange={handleImportAllModeChange}
        onStartImport={() => startImport()}
        onReset={resetImportState}
      />
      <ExportAllModal
        isOpen={isExportAllModalOpen}
        phase={exportPhase}
        progressMessage={exportProgressMessage}
        counts={exportCounts}
        errorMessage={exportErrorMessage}
        onClose={() => {
          handleExportAllClose();
          resetExportState();
        }}
      />
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
                onMouseDown={handleMouseResizeStart}
                onTouchStart={handleTouchResizeStart}
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
                    onTogglePin={handleTogglePanel}
                    onNewCanvas={handleNewCanvasEnhanced}
                    onNewProject={() => setShowProjectModal(true)}
                    onSearchOpen={() => dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: true })}
                    shortcuts={shortcuts}
                    onExportAll={handleExportAll}
                    isExportingAll={isExportingAll}
                    onImportAll={handleImportAllClick}
                    isImportingAll={isImportingAll}
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
