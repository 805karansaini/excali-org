import { ExcalidrawElement, AppState } from "./excalidraw-types";

// Legacy - now handled by InternalEventBus
export enum STORAGE_KEYS {
  CURRENT_WORKING_FILE_ID = "current-working-file-id",
}

export type ExcalidrawType = {
  angle: number;
  backgroundColor: string;
  boundElements: ExcalidrawElement[] | null;
  fillStyle: string;
  frameId: string | null;
  groupIds: string[];
  height: number;
  id: string;
  index: string;
  isDeleted: boolean;
  link: string | null;
  locked: boolean;
  opacity: number;
  roughness: number;
  roundness: { type: number } | null;
  seed: number;
  strokeColor: string;
  strokeStyle: string;
  strokeWidth: number;
  type: string;
  updated: number;
  version: number;
  versionNonce: number;
  width: number;
  x: number;
  y: number;
};

export interface UnifiedCanvas {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  lastModified: string;
  projectId?: string;

  // Excalidraw data - combining old File format and new Canvas format
  elements: readonly ExcalidrawElement[]; // New Canvas format
  excalidraw: readonly ExcalidrawElement[] | ExcalidrawType[]; // Old File format - migration compatibility
  appState?: AppState; // New Canvas format
}

export interface UnifiedProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: Date;
  updatedAt?: Date;

  canvasIds: string[];
  fileIds?: string[];
}

export interface SearchResult {
  type: "canvas" | "project";
  item: UnifiedCanvas | UnifiedProject;
  matches: string[];
}

export interface ContextMenuData {
  x: number;
  y: number;
  canvas: UnifiedCanvas;
}

export interface ProjectContextMenuData {
  x: number;
  y: number;
  project: UnifiedProject;
}

// Deprecated type aliases - use UnifiedCanvas and UnifiedProject directly
// Keeping for backward compatibility only
export type File = UnifiedCanvas;
export type Canvas = UnifiedCanvas;
export type Project = UnifiedProject;

export type UnifiedAction =
  // Data operations
  | { type: "SET_PROJECTS"; payload: UnifiedProject[] }
  | { type: "SET_CANVASES"; payload: UnifiedCanvas[] }
  | { type: "ADD_CANVAS"; payload: UnifiedCanvas }
  | { type: "UPDATE_CANVAS"; payload: UnifiedCanvas }
  | { type: "DELETE_CANVAS"; payload: string }
  | { type: "ADD_PROJECT"; payload: UnifiedProject }
  | { type: "UPDATE_PROJECT"; payload: UnifiedProject }
  | {
      type: "DELETE_PROJECT";
      payload: string | { projectId: string; canvasAction: "keep" | "delete" };
    }
  | { type: "SET_CURRENT_WORKING_CANVAS"; payload: string | null }
  // Search operations
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_SEARCH_RESULTS"; payload: SearchResult[] }
  | { type: "TOGGLE_SEARCH_MODAL" }
  | { type: "SET_SEARCH_MODAL"; payload: boolean }
  | { type: "SET_SEARCH_MODAL_OPEN"; payload: boolean }
  | { type: "SET_HELP_MODAL_OPEN"; payload: boolean }
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
