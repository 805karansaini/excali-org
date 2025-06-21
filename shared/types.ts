export enum STORAGE_KEYS {
  FILE = "file",
  COLLECTION = "collection",
  CURRENT_WORKING_FILE_ID = "current-working-file-id",
  IS_INDEXEDDB_MIGRATED = "is-indexeddb-migrated",
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
