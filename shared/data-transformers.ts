import { UnifiedCanvas, UnifiedProject, ExcalidrawType } from './types';
import { ExcalidrawElement } from './excalidraw-types';
interface LegacyFile {
  id: string;
  name: string;
  lastModified: string;
  excalidraw: ExcalidrawElement[] | ExcalidrawType[];
}

interface LegacyCollection {
  id: string;
  name: string;
  fileIds: string[];
}


export function transformFileToCanvas(file: LegacyFile): UnifiedCanvas {
  return {
    id: file.id,
    name: file.name,
    thumbnail: undefined,
    createdAt: new Date(file.lastModified),
    updatedAt: new Date(file.lastModified),
    lastModified: file.lastModified,
    projectId: undefined,
    elements: Array.isArray(file.excalidraw) ? file.excalidraw : [],
    excalidraw: file.excalidraw,
    appState: {
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
      width: 800,
      height: 600,
      viewBackgroundColor: '#ffffff',
      theme: 'light' as const,
      selectedElementIds: {},
      editingGroupId: null,
      viewModeEnabled: false
    }
  };
}

export function transformCollectionToProject(collection: LegacyCollection): UnifiedProject {
  const now = new Date();

  return {
    id: collection.id,
    name: collection.name,
    description: undefined,
    color: '#4ECDC4',
    createdAt: now,
    updatedAt: now,

    canvasIds: collection.fileIds,
    fileIds: collection.fileIds,
  };
}
