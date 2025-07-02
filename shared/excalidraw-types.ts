// Define the types directly since they are not exported from @excalidraw/excalidraw
export interface ExcalidrawElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  type: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: readonly string[];
  frameId: string | null;
  roundness: {
    type: number;
    value?: number;
  } | null;
  boundElements: readonly {
    id: string;
    type: string;
  }[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  [key: string]: any;
}

export interface AppState {
  zoom: {
    value: number;
  };
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  viewBackgroundColor: string;
  theme: 'light' | 'dark';
  selectedElementIds: Record<string, boolean>;
  editingGroupId: string | null;
  viewModeEnabled: boolean;
  [key: string]: any;
}

export interface BinaryFiles {
  [id: string]: {
    mimeType: string;
    id: string;
    dataURL: string;
    created: number;
    lastRetrieved?: number;
  };
}
