export enum STORAGE_KEYS {
  // Legacy keys removed: FILE, COLLECTION, IS_INDEXEDDB_MIGRATED
  CURRENT_WORKING_FILE_ID = "current-working-file-id",
}

export enum MessageTypes {
  LOAD_EXCALIDRAW_FILE = "LOAD_EXCALIDRAW_FILE",
  PUSH_EXCALIDRAW_FILE = "PUSH_EXCALIDRAW_FILE",
  PUSH_CURRENT_WORKING_FILE_NAME = "PUSH_CURRENT_WORKING_FILE_NAME",
  PULL_CURRENT_WORKING_FILE_NAME = "PULL_CURRENT_WORKING_FILE_NAME",
}

export type Message = {
  type: MessageTypes;
  body?: Record<string, unknown>;
};

export type ExcalidrawType = {
  angle: number;
  backgroundColor: string;
  boundElements: any[] | null;
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
  roundness: any | null;
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
  elements: any[]; // New Canvas format
  excalidraw: any[] | ExcalidrawType[]; // Old File format - migration compatibility
  appState?: any; // New Canvas format
}

export interface UnifiedProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: Date;
  updatedAt?: Date;

  // Migration compatibility fields - supporting both old Collection and new Project formats
  canvasIds: string[]; // New Project format - primary
  fileIds?: string[]; // Old Collection format - migration compatibility
}

// Search and UI types
export interface SearchResult {
  type: 'canvas' | 'project';
  item: UnifiedCanvas | UnifiedProject;
  matches: string[];
}

export interface ContextMenuData {
  x: number;
  y: number;
  canvas: UnifiedCanvas;
}

// Legacy type aliases for backward compatibility during migration
export type File = UnifiedCanvas; // Old popup type alias
export type Collection = UnifiedProject; // Old popup type alias
export type Canvas = UnifiedCanvas; // Project type alias
export type Project = UnifiedProject; // Project type alias
