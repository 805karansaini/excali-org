import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import {
  UnifiedCanvas,
  UnifiedProject,
  SearchResult,
  ContextMenuData,
  ProjectContextMenuData,
} from "../../shared/types";
import {
  canvasOperations,
  projectOperations,
  settingsOperations,
  dbUtils,
} from "../../shared/unified-db";
import {
  globalEventBus,
  InternalEventTypes,
} from "../messaging/InternalEventBus";
import { ExcalidrawElement, AppState } from "../../shared/excalidraw-types";

// Enhanced state interface combining data and UI state
interface UnifiedState {
  // Core data
  projects: UnifiedProject[];
  canvases: UnifiedCanvas[];
  currentWorkingCanvasId: string | null;

  // Search state
  searchQuery: string;
  searchResults: SearchResult[];
  isSearchModalOpen: boolean;

  // UI state
  selectedCanvasId: string | null;
  contextMenu: ContextMenuData | null;
  projectContextMenu: ProjectContextMenuData | null;
  theme: "light" | "dark";

  // Panel state
  isPanelVisible: boolean;
  isPanelPinned: boolean;
  panelWidth: number;
  collapsedProjects: Set<string>;

  // Loading and error state
  isLoading: boolean;
  loadingCanvasId: string | null;
  error: string | null;
  dbError: boolean;
}

type UnifiedAction =
  // Data operations
  | { type: "SET_PROJECTS"; payload: UnifiedProject[] }
  | { type: "SET_CANVASES"; payload: UnifiedCanvas[] }
  | { type: "ADD_CANVAS"; payload: UnifiedCanvas }
  | { type: "UPDATE_CANVAS"; payload: UnifiedCanvas }
  | { type: "DELETE_CANVAS"; payload: string }
  | { type: "ADD_PROJECT"; payload: UnifiedProject }
  | { type: "UPDATE_PROJECT"; payload: UnifiedProject }
  | { type: "DELETE_PROJECT"; payload: string | { projectId: string; canvasAction: 'keep' | 'delete' } }
  | { type: "SET_CURRENT_WORKING_CANVAS"; payload: string | null }

  // Search operations
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_SEARCH_RESULTS"; payload: SearchResult[] }
  | { type: "TOGGLE_SEARCH_MODAL" }
  | { type: "SET_SEARCH_MODAL"; payload: boolean }
  | { type: "SET_SEARCH_MODAL_OPEN"; payload: boolean }

  // UI operations
  | { type: "SET_SELECTED_CANVAS"; payload: string | null }
  | { type: "SET_CONTEXT_MENU"; payload: ContextMenuData | null }
  | { type: "SET_PROJECT_CONTEXT_MENU"; payload: ProjectContextMenuData | null }
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "TOGGLE_THEME" }

  // Panel operations
  | { type: "SET_PANEL_VISIBLE"; payload: boolean }
  | { type: "SET_PANEL_PINNED"; payload: boolean }
  | { type: "SET_PANEL_WIDTH"; payload: number }
  | { type: "TOGGLE_PROJECT_COLLAPSED"; payload: string }
  | { type: "SET_COLLAPSED_PROJECTS"; payload: Set<string> }

  // System operations
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_LOADING_CANVAS"; payload: string | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_DB_ERROR"; payload: boolean }
  | {
      type: "ADD_CANVAS_TO_PROJECT";
      payload: { canvasId: string; projectId: string };
    }
  | {
      type: "REMOVE_CANVAS_FROM_PROJECT";
      payload: { canvasId: string; projectId: string };
    };

const initialState: UnifiedState = {
  // Core data
  projects: [],
  canvases: [],
  currentWorkingCanvasId: null,

  // Search state
  searchQuery: "",
  searchResults: [],
  isSearchModalOpen: false,

  // UI state
  selectedCanvasId: null,
  contextMenu: null,
  projectContextMenu: null,
  theme: "light",

  // Panel state
  isPanelVisible: false,
  isPanelPinned: false,
  panelWidth: 320,
  collapsedProjects: new Set(),

  // Loading and error state
  isLoading: false,
  loadingCanvasId: null,
  error: null,
  dbError: false,
};

function unifiedStateReducer(
  state: UnifiedState,
  action: UnifiedAction,
): UnifiedState {
  switch (action.type) {
    // Data operations
    case "SET_PROJECTS":
      return { ...state, projects: action.payload };

    case "SET_CANVASES":
      return { ...state, canvases: action.payload };

    case "ADD_CANVAS":
      return {
        ...state,
        canvases: [action.payload, ...state.canvases],
        currentWorkingCanvasId: action.payload.id,
      };

    case "UPDATE_CANVAS":
      return {
        ...state,
        canvases: state.canvases.map((canvas) =>
          canvas.id === action.payload.id ? action.payload : canvas,
        ),
      };

    case "DELETE_CANVAS":
      return {
        ...state,
        canvases: state.canvases.filter(
          (canvas) => canvas.id !== action.payload,
        ),
        projects: state.projects.map((project) => ({
          ...project,
          canvasIds: project.canvasIds.filter((id) => id !== action.payload),
        })),
        selectedCanvasId:
          state.selectedCanvasId === action.payload
            ? null
            : state.selectedCanvasId,
        currentWorkingCanvasId:
          state.currentWorkingCanvasId === action.payload
            ? null
            : state.currentWorkingCanvasId,
      };

    case "ADD_PROJECT":
      return { ...state, projects: [...state.projects, action.payload] };

    case "UPDATE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.payload.id ? action.payload : project,
        ),
      };

    case "DELETE_PROJECT":
      const deletePayload = typeof action.payload === 'string' 
        ? { projectId: action.payload, canvasAction: 'keep' as const }
        : action.payload;
      
      return {
        ...state,
        projects: state.projects.filter(
          (project) => project.id !== deletePayload.projectId,
        ),
        canvases: deletePayload.canvasAction === 'delete' 
          ? state.canvases.filter((canvas) => canvas.projectId !== deletePayload.projectId)
          : state.canvases.map((canvas) =>
              canvas.projectId === deletePayload.projectId
                ? { ...canvas, projectId: undefined }
                : canvas,
            ),
        collapsedProjects: new Set(
          [...state.collapsedProjects].filter((id) => id !== deletePayload.projectId),
        ),
      };

    case "SET_CURRENT_WORKING_CANVAS":
      return { ...state, currentWorkingCanvasId: action.payload };

    // Search operations
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };

    case "SET_SEARCH_RESULTS":
      return { ...state, searchResults: action.payload };

    case "TOGGLE_SEARCH_MODAL":
      return { ...state, isSearchModalOpen: !state.isSearchModalOpen };

    case "SET_SEARCH_MODAL":
      return { ...state, isSearchModalOpen: action.payload };

    case "SET_SEARCH_MODAL_OPEN":
      return { ...state, isSearchModalOpen: action.payload };

    // UI operations
    case "SET_SELECTED_CANVAS":
      return { ...state, selectedCanvasId: action.payload };

    case "SET_CONTEXT_MENU":
      return { ...state, contextMenu: action.payload };

    case "SET_PROJECT_CONTEXT_MENU":
      return { ...state, projectContextMenu: action.payload };

    case "SET_THEME":
      return { ...state, theme: action.payload };

    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "light" ? "dark" : "light" };

    // Panel operations
    case "SET_PANEL_VISIBLE":
      return { ...state, isPanelVisible: action.payload };

    case "SET_PANEL_PINNED":
      return { ...state, isPanelPinned: action.payload };

    case "SET_PANEL_WIDTH":
      return { ...state, panelWidth: action.payload };

    case "TOGGLE_PROJECT_COLLAPSED": {
      const newCollapsed = new Set(state.collapsedProjects);
      if (newCollapsed.has(action.payload)) {
        newCollapsed.delete(action.payload);
      } else {
        newCollapsed.add(action.payload);
      }
      return { ...state, collapsedProjects: newCollapsed };
    }

    case "SET_COLLAPSED_PROJECTS":
      return { ...state, collapsedProjects: action.payload };

    // System operations
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_LOADING_CANVAS":
      return { ...state, loadingCanvasId: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_DB_ERROR":
      return { ...state, dbError: action.payload };

    case "ADD_CANVAS_TO_PROJECT":
      return {
        ...state,
        canvases: state.canvases.map((canvas) =>
          canvas.id === action.payload.canvasId
            ? { ...canvas, projectId: action.payload.projectId }
            : canvas,
        ),
        projects: state.projects.map((project) =>
          project.id === action.payload.projectId
            ? {
                ...project,
                canvasIds: [...project.canvasIds, action.payload.canvasId],
              }
            : project,
        ),
      };

    case "REMOVE_CANVAS_FROM_PROJECT":
      return {
        ...state,
        canvases: state.canvases.map((canvas) =>
          canvas.id === action.payload.canvasId
            ? { ...canvas, projectId: undefined }
            : canvas,
        ),
        projects: state.projects.map((project) =>
          project.id === action.payload.projectId
            ? {
                ...project,
                canvasIds: project.canvasIds.filter(
                  (id) => id !== action.payload.canvasId,
                ),
              }
            : project,
        ),
      };

    default:
      return state;
  }
}

// Context definition
interface UnifiedStateContextType {
  state: UnifiedState;
  dispatch: React.Dispatch<UnifiedAction>;
  // Convenience functions for common operations
  loadInitialData: () => Promise<void>;
  saveCanvas: (canvas: UnifiedCanvas) => Promise<void>;
  createCanvas: (
    canvas: Omit<UnifiedCanvas, "id" | "createdAt" | "updatedAt">,
  ) => Promise<UnifiedCanvas>;
  removeCanvas: (canvasId: string) => Promise<void>;
  saveProject: (project: UnifiedProject) => Promise<void>;
  createProject: (
    project: Omit<UnifiedProject, "id" | "createdAt">,
  ) => Promise<UnifiedProject>;
  removeProject: (projectId: string) => Promise<void>;
  updatePanelSettings: (
    settings: Partial<{
      isPinned: boolean;
      width: number;
      collapsedProjects: string[];
    }>,
  ) => Promise<void>;
  getCanvasesForProject: (projectId: string) => UnifiedCanvas[];
  getUnorganizedCanvases: () => UnifiedCanvas[];
}

const UnifiedStateContext = createContext<UnifiedStateContextType | null>(null);

// Provider component
export function UnifiedStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(unifiedStateReducer, initialState);

  // Initialize theme synchronization with Excalidraw
  useEffect(() => {
    let themeObserver: MutationObserver | null = null;
    let intervalId: number | null = null;

    const detectExcalidrawTheme = (): "light" | "dark" => {
      try {
        // Method 1: Official Excalidraw theme storage
        const excalidrawState = localStorage.getItem("excalidraw-state");
        if (excalidrawState) {
          const state = JSON.parse(excalidrawState);
          console.log("Theme detection - excalidraw-state:", state.theme);
          if (state.theme === "dark" || state.theme === "light") {
            return state.theme;
          }
        }

        // Method 2: Check appState in localStorage
        const excalidrawData = localStorage.getItem("excalidraw");
        if (excalidrawData) {
          const data = JSON.parse(excalidrawData);
          console.log(
            "Theme detection - excalidraw appState:",
            data.appState?.theme,
          );
          if (data.appState?.theme) {
            return data.appState.theme;
          }
        }

        // Method 3: System preference fallback
        const systemDark = window.matchMedia?.(
          "(prefers-color-scheme: dark)",
        ).matches;
        console.log(
          "Theme detection - system preference:",
          systemDark ? "dark" : "light",
        );
        if (systemDark) {
          return "dark";
        }

        // Default to light (matches Excalidraw.com)
        console.log("Theme detection - using default: light");
        return "light";
      } catch (error) {
        console.error("Theme detection failed:", error);
        return "light"; // Safe fallback
      }
    };

    const updateTheme = () => {
      try {
        const detectedTheme = detectExcalidrawTheme();

        if (detectedTheme !== state.theme) {
          console.log(
            `Theme change detected: ${state.theme} → ${detectedTheme}`,
          );
          dispatch({ type: "SET_THEME", payload: detectedTheme });
          globalEventBus.emit(InternalEventTypes.THEME_CHANGED, detectedTheme);
          // Set data-theme attribute on document root for CSS variables to work globally
          document.documentElement.setAttribute("data-theme", detectedTheme);
          console.log(
            `Set document.documentElement data-theme to: ${detectedTheme}`,
          );
        }
      } catch (error) {
        console.error("Error detecting theme:", error);
      }
    };

    // Initial theme detection
    console.log("Starting initial theme detection...");
    updateTheme();

    // Ensure document has the initial theme attribute set (fallback)
    setTimeout(() => {
      const currentAttribute =
        document.documentElement.getAttribute("data-theme");
      if (!currentAttribute) {
        const fallbackTheme = detectExcalidrawTheme();
        document.documentElement.setAttribute("data-theme", fallbackTheme);
        console.log(
          `Fallback: Set initial theme to ${fallbackTheme} (attribute was null)`,
        );
      } else {
        console.log(`Initial theme attribute already set: ${currentAttribute}`);
      }
    }, 100);

    // Method 1: Use MutationObserver to watch for class changes
    themeObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          const attributeName = mutation.attributeName;
          const target = mutation.target as Element;
          console.log(
            `DOM mutation detected: ${attributeName} on ${target.tagName}`,
          );

          if (attributeName === "class" || attributeName === "data-theme") {
            shouldUpdate = true;
            console.log(`Theme-relevant attribute changed: ${attributeName}`);
          }
        }
      });

      if (shouldUpdate) {
        console.log("Triggering theme update due to DOM mutation");
        // Debounce the update
        setTimeout(updateTheme, 100);
      }
    });

    // Observe changes on relevant elements
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Method 2: Periodic check as fallback
    intervalId = setInterval(updateTheme, 2000);

    // Method 3: Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      setTimeout(updateTheme, 100);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }

    // Method 4: Listen for storage events (in case theme is stored)
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "excalidraw-theme" ||
        e.key === "theme" ||
        e.key === "excalidraw-state"
      ) {
        console.log(`Storage change detected for key: ${e.key}`);
        if (e.key === "excalidraw-state" && e.newValue) {
          try {
            const newState = JSON.parse(e.newValue);
            console.log(`New excalidraw-state theme: ${newState.theme}`);
          } catch {
            console.log("Could not parse new storage value");
          }
        }
        setTimeout(updateTheme, 100);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Method 5: Listen for custom events that might indicate theme change
    const handleCustomThemeEvent = () => {
      setTimeout(updateTheme, 100);
    };

    window.addEventListener("theme-changed", handleCustomThemeEvent);
    window.addEventListener("excalidraw-theme-changed", handleCustomThemeEvent);

    // Cleanup
    return () => {
      if (themeObserver) {
        themeObserver.disconnect();
      }

      if (intervalId) {
        clearInterval(intervalId);
      }

      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }

      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("theme-changed", handleCustomThemeEvent);
      window.removeEventListener(
        "excalidraw-theme-changed",
        handleCustomThemeEvent,
      );
    };
  }, [state.theme, dispatch]);

  // Initialize data and settings from IndexedDB
  const loadInitialData = useCallback(async () => {
    try {
      console.log("Loading initial data from database...");
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      // Check database accessibility
      const dbAccessible = await dbUtils.isAccessible();
      console.log("Database accessible:", dbAccessible);

      if (!dbAccessible) {
        console.error("Database is not accessible");
        dispatch({ type: "SET_DB_ERROR", payload: true });
        dispatch({
          type: "SET_ERROR",
          payload: "Unable to access database. Some features may not work.",
        });
        return;
      }

      // Load data in parallel
      console.log("Loading projects, canvases, and panel settings...");
      const [projects, canvases, panelSettings] = await Promise.all([
        projectOperations.getAllProjects(),
        canvasOperations.getAllCanvases(),
        loadPanelSettings(),
      ]);

      console.log("Loaded data:", {
        projects: projects.length,
        canvases: canvases.length,
        panelSettings,
      });

      dispatch({ type: "SET_PROJECTS", payload: projects });
      dispatch({ type: "SET_CANVASES", payload: canvases });

      // Apply panel settings
      dispatch({ type: "SET_PANEL_PINNED", payload: panelSettings.isPinned });
      dispatch({ type: "SET_PANEL_WIDTH", payload: panelSettings.width });
      dispatch({
        type: "SET_COLLAPSED_PROJECTS",
        payload: new Set(panelSettings.collapsedProjects),
      });

      // Load current working canvas
      const currentCanvasId = await settingsOperations.getSetting(
        "currentWorkingCanvasId",
      );
      if (currentCanvasId && typeof currentCanvasId === "string") {
        console.log("Current working canvas ID:", currentCanvasId);
        dispatch({
          type: "SET_CURRENT_WORKING_CANVAS",
          payload: currentCanvasId,
        });
      }

      console.log("Initial data loading completed successfully");
    } catch (error) {
      console.error("Failed to load initial data:", error);
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to load data from database.",
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Load panel settings from IndexedDB
  const loadPanelSettings = async () => {
    const [isPinned, width, collapsedProjectsStr] = await Promise.all([
      settingsOperations.getSetting("panelIsPinned"),
      settingsOperations.getSetting("panelWidth"),
      settingsOperations.getSetting("collapsedProjects"),
    ]);

    return {
      isPinned: isPinned === true,
      width:
        typeof width === "number" ? Math.max(200, Math.min(600, width)) : 320,
      collapsedProjects: Array.isArray(collapsedProjectsStr)
        ? collapsedProjectsStr
        : [],
    };
  };

  // Save canvas with database sync
  const saveCanvas = useCallback(async (canvas: UnifiedCanvas) => {
    try {
      await canvasOperations.updateCanvas(canvas);
      dispatch({ type: "UPDATE_CANVAS", payload: canvas });
    } catch (error) {
      console.error("Failed to save canvas:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to save canvas." });
      throw error;
    }
  }, []);

  // Create new canvas
  const createCanvas = useCallback(
    async (
      canvasData: Omit<UnifiedCanvas, "id" | "createdAt" | "updatedAt">,
    ) => {
      try {
        const now = new Date();
        const canvas: UnifiedCanvas = {
          ...canvasData,
          id: `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: now,
          updatedAt: now,
          lastModified: now.toISOString(),
          excalidraw: canvasData.elements || [], // Backward compatibility
        };

        await canvasOperations.addCanvas(canvas);
        dispatch({ type: "ADD_CANVAS", payload: canvas });
        return canvas;
      } catch (error) {
        console.error("Failed to create canvas:", error);
        dispatch({ type: "SET_ERROR", payload: "Failed to create canvas." });
        throw error;
      }
    },
    [],
  );

  // Remove canvas
  const removeCanvas = useCallback(async (canvasId: string) => {
    try {
      await canvasOperations.deleteCanvas(canvasId);
      dispatch({ type: "DELETE_CANVAS", payload: canvasId });
    } catch (error) {
      console.error("Failed to delete canvas:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to delete canvas." });
      throw error;
    }
  }, []);

  // Save project with database sync
  const saveProject = useCallback(async (project: UnifiedProject) => {
    try {
      await projectOperations.updateProject(project);
      dispatch({ type: "UPDATE_PROJECT", payload: project });
    } catch (error) {
      console.error("Failed to save project:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to save project." });
      throw error;
    }
  }, []);

  // Create new project
  const createProject = useCallback(
    async (projectData: Omit<UnifiedProject, "id" | "createdAt">) => {
      try {
        const project: UnifiedProject = {
          ...projectData,
          id: `project_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date(),
          canvasIds: projectData.canvasIds || [],
          fileIds: projectData.canvasIds || [], // Backward compatibility
        };

        await projectOperations.addProject(project);
        dispatch({ type: "ADD_PROJECT", payload: project });
        return project;
      } catch (error) {
        console.error("Failed to create project:", error);
        dispatch({ type: "SET_ERROR", payload: "Failed to create project." });
        throw error;
      }
    },
    [],
  );

  // Remove project
  const removeProject = useCallback(async (projectId: string) => {
    try {
      await projectOperations.deleteProject(projectId);
      dispatch({ type: "DELETE_PROJECT", payload: projectId });
    } catch (error) {
      console.error("Failed to delete project:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to delete project." });
      throw error;
    }
  }, []);

  // Update panel settings
  const updatePanelSettings = useCallback(
    async (
      settings: Partial<{
        isPinned: boolean;
        width: number;
        collapsedProjects: string[];
      }>,
    ) => {
      try {
        const promises: Promise<void>[] = [];

        if (settings.isPinned !== undefined) {
          promises.push(
            settingsOperations.setSetting("panelIsPinned", settings.isPinned),
          );
          dispatch({ type: "SET_PANEL_PINNED", payload: settings.isPinned });
        }

        if (settings.width !== undefined) {
          promises.push(
            settingsOperations.setSetting("panelWidth", settings.width),
          );
          dispatch({ type: "SET_PANEL_WIDTH", payload: settings.width });
        }

        if (settings.collapsedProjects !== undefined) {
          promises.push(
            settingsOperations.setSetting(
              "collapsedProjects",
              settings.collapsedProjects,
            ),
          );
          dispatch({
            type: "SET_COLLAPSED_PROJECTS",
            payload: new Set(settings.collapsedProjects),
          });
        }

        await Promise.all(promises);
      } catch (error) {
        console.error("Failed to save panel settings:", error);
      }
    },
    [],
  );

  // Convenience functions for canvas filtering
  const getCanvasesForProject = useCallback(
    (projectId: string) => {
      return state.canvases.filter((canvas) => canvas.projectId === projectId);
    },
    [state.canvases],
  );

  const getUnorganizedCanvases = useCallback(() => {
    return state.canvases.filter((canvas) => !canvas.projectId);
  }, [state.canvases]);

  // Auto-save current working canvas ID
  useEffect(() => {
    if (state.currentWorkingCanvasId) {
      settingsOperations
        .setSetting("currentWorkingCanvasId", state.currentWorkingCanvasId)
        .catch(console.error);
    }
  }, [state.currentWorkingCanvasId]);

  // Setup event listener for canvas data sync
  useEffect(() => {
    const handleSyncExcalidrawData = async ({
      elements,
      appState,
    }: {
      elements: readonly ExcalidrawElement[];
      appState: AppState;
    }) => {
      try {
        console.log(
          "Handling SYNC_EXCALIDRAW_DATA event with",
          elements?.length || 0,
          "elements",
        );

        // Only save if we have a current working canvas
        if (!state.currentWorkingCanvasId) {
          console.log("No current working canvas - skipping auto-save");
          return;
        }

        // Find the current canvas
        const currentCanvas = state.canvases.find(
          (canvas) => canvas.id === state.currentWorkingCanvasId,
        );
        if (!currentCanvas) {
          console.log(
            "Current working canvas not found in canvases array - skipping auto-save",
          );
          console.log(
            "Available canvas IDs:",
            state.canvases.map((c) => c.id),
          );
          return;
        }

        // Check if there are actually changes to save
        const hasElements =
          elements && Array.isArray(elements) && elements.length > 0;
        const existingElements =
          currentCanvas.elements || currentCanvas.excalidraw || [];

        if (!hasElements && existingElements.length === 0) {
          console.log(
            "No elements to save and no existing elements - skipping auto-save",
          );
          return;
        }

        // Create updated canvas with new data
        const updatedCanvas: UnifiedCanvas = {
          ...currentCanvas,
          elements: elements || [],
          appState: appState || currentCanvas.appState || {},
          excalidraw: elements || [], // Backward compatibility
          updatedAt: new Date(),
          lastModified: new Date().toISOString(),
        };

        // Save to database
        console.log(
          "Auto-saving canvas:",
          currentCanvas.name,
          "with",
          elements?.length || 0,
          "elements",
        );
        await canvasOperations.updateCanvas(updatedCanvas);

        // Update state
        dispatch({ type: "UPDATE_CANVAS", payload: updatedCanvas });

        console.log("Canvas auto-saved successfully:", updatedCanvas.name);
      } catch (error) {
        console.error("Failed to auto-save canvas:", error);
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to auto-save canvas changes.",
        });
      }
    };

    // Subscribe to the event
    const unsubscribe = globalEventBus.on(
      InternalEventTypes.SYNC_EXCALIDRAW_DATA,
      handleSyncExcalidrawData,
    );

    // Return cleanup function
    return unsubscribe;
  }, [state.currentWorkingCanvasId, state.canvases]);

  // Setup event listener for canvas selection
  useEffect(() => {
    const handleCanvasSelected = async (canvas: UnifiedCanvas) => {
      try {
        console.log("Canvas selected:", canvas.name);

        // Set as current working canvas
        dispatch({ type: "SET_CURRENT_WORKING_CANVAS", payload: canvas.id });

        // Save to settings for persistence across reloads
        await settingsOperations.setSetting(
          "currentWorkingCanvasId",
          canvas.id,
        );

        console.log("Current working canvas updated to:", canvas.id);
      } catch (error) {
        console.error("Failed to set current working canvas:", error);
      }
    };

    // Subscribe to canvas selection events
    const unsubscribe = globalEventBus.on(
      InternalEventTypes.CANVAS_SELECTED,
      handleCanvasSelected,
    );

    // Return cleanup function
    return unsubscribe;
  }, []);

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const contextValue: UnifiedStateContextType = {
    state,
    dispatch,
    loadInitialData,
    saveCanvas,
    createCanvas,
    removeCanvas,
    saveProject,
    createProject,
    removeProject,
    updatePanelSettings,
    getCanvasesForProject,
    getUnorganizedCanvases,
  };

  return (
    <UnifiedStateContext.Provider value={contextValue}>
      {children}
    </UnifiedStateContext.Provider>
  );
}

// Hook to use the unified state
export function useUnifiedState() {
  const context = useContext(UnifiedStateContext);
  if (!context) {
    throw new Error(
      "useUnifiedState must be used within a UnifiedStateProvider",
    );
  }
  return context;
}
