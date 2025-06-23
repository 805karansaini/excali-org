// TODO: Phase 1.2 - Data Transformation Utilities
// These functions handle transformation between old popup types (File, Collection)
// and new unified types (UnifiedCanvas, UnifiedProject)

import { UnifiedCanvas, UnifiedProject, ExcalidrawType } from './types';

// Legacy type interfaces for transformation (based on old popup structure)
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

interface LegacyCanvas {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;
  elements: any[];
  appState: any;
}

interface LegacyProject {
  id: string;
  name: string;
  description?: string;
  canvasIds: string[];
  createdAt: Date;
  color: string;
}

/**
 * Transform old popup File format to unified Canvas format
 */
export function transformFileToCanvas(file: LegacyFile): UnifiedCanvas {
  return {
    id: file.id,
    name: file.name,
    thumbnail: undefined, // Will be generated later
    createdAt: new Date(file.lastModified), // Use lastModified as createdAt fallback
    updatedAt: new Date(file.lastModified),
    lastModified: file.lastModified, // Keep for migration compatibility
    projectId: undefined, // Files start unorganized

    // Excalidraw data
    elements: Array.isArray(file.excalidraw) ? file.excalidraw : [], // New format
    excalidraw: file.excalidraw, // Keep old format for compatibility
    appState: {}, // Default app state
  };
}

/**
 * Transform old popup Collection format to unified Project format
 */
export function transformCollectionToProject(collection: LegacyCollection): UnifiedProject {
  const now = new Date();

  return {
    id: collection.id,
    name: collection.name,
    description: undefined,
    color: generateRandomColor(), // Generate random color for migrated collections
    createdAt: now,
    updatedAt: now,

    // Migration compatibility
    canvasIds: collection.fileIds, // Map fileIds to canvasIds
    fileIds: collection.fileIds, // Keep for migration compatibility
  };
}

/**
 * Transform new project Canvas format to unified Canvas format
 */
export function transformCanvasToUnified(canvas: LegacyCanvas): UnifiedCanvas {
  return {
    id: canvas.id,
    name: canvas.name,
    thumbnail: canvas.thumbnail,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    lastModified: canvas.updatedAt.toISOString(), // Generate lastModified for compatibility
    projectId: canvas.projectId,

    // Excalidraw data
    elements: canvas.elements,
    excalidraw: canvas.elements, // Map elements to excalidraw for compatibility
    appState: canvas.appState,
  };
}

/**
 * Transform new project Project format to unified Project format
 */
export function transformProjectToUnified(project: LegacyProject): UnifiedProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.createdAt, // Use createdAt as updatedAt fallback

    // Compatibility
    canvasIds: project.canvasIds,
    fileIds: project.canvasIds, // Map canvasIds to fileIds for compatibility
  };
}

/**
 * Transform unified Canvas back to old File format (for rollback scenarios)
 */
export function transformCanvasToFile(canvas: UnifiedCanvas): LegacyFile {
  return {
    id: canvas.id,
    name: canvas.name,
    lastModified: canvas.lastModified || canvas.updatedAt.toISOString(),
    excalidraw: canvas.excalidraw,
  };
}

/**
 * Transform unified Project back to old Collection format (for rollback scenarios)
 */
export function transformProjectToCollection(project: UnifiedProject): LegacyCollection {
  return {
    id: project.id,
    name: project.name,
    fileIds: project.fileIds || project.canvasIds,
  };
}

/**
 * Validate unified Canvas data integrity
 */
export function validateUnifiedCanvas(canvas: UnifiedCanvas): boolean {
  try {
    // Required fields
    if (!canvas.id || !canvas.name) return false;
    if (!canvas.createdAt || !canvas.updatedAt) return false;

    // Ensure at least one excalidraw data format exists
    if (!canvas.elements && !canvas.excalidraw) return false;

    // Validate dates
    if (isNaN(canvas.createdAt.getTime()) || isNaN(canvas.updatedAt.getTime())) return false;

    return true;
  } catch (error) {
    console.error('Canvas validation error:', error);
    return false;
  }
}

/**
 * Validate unified Project data integrity
 */
export function validateUnifiedProject(project: UnifiedProject): boolean {
  try {
    // Required fields
    if (!project.id || !project.name || !project.color) return false;
    if (!project.createdAt) return false;

    // Ensure at least one canvas ID array exists
    if (!project.canvasIds && !project.fileIds) return false;
    if (!Array.isArray(project.canvasIds) && !Array.isArray(project.fileIds)) return false;

    // Validate dates
    if (isNaN(project.createdAt.getTime())) return false;
    if (project.updatedAt && isNaN(project.updatedAt.getTime())) return false;

    return true;
  } catch (error) {
    console.error('Project validation error:', error);
    return false;
  }
}

/**
 * Generate random color for migrated collections
 */
function generateRandomColor(): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Yellow
    '#FF9FF3', // Pink
    '#54A0FF', // Light Blue
    '#5F27CD', // Purple
    '#00D2D3', // Cyan
    '#FF9F43', // Orange
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Batch transform multiple files to canvases
 */
export function batchTransformFilesToCanvases(files: LegacyFile[]): UnifiedCanvas[] {
  return files.map(transformFileToCanvas).filter(validateUnifiedCanvas);
}

/**
 * Batch transform multiple collections to projects
 */
export function batchTransformCollectionsToProjects(collections: LegacyCollection[]): UnifiedProject[] {
  return collections.map(transformCollectionToProject).filter(validateUnifiedProject);
}
