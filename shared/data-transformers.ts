import { UnifiedCanvas, UnifiedProject, ExcalidrawType } from './types';
interface LegacyFile {
  id: string;
  name: string;
  lastModified: string;
  excalidraw: any[] | ExcalidrawType[];
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
    appState: {}
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
