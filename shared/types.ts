export enum STORAGE_KEYS {
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

  canvasIds: string[];
  fileIds?: string[];
}

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

export type File = UnifiedCanvas;
export type Collection = UnifiedProject;
export type Canvas = UnifiedCanvas;
export type Project = UnifiedProject;
