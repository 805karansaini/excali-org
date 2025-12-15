import type { UnifiedProject } from './types';

export const checkIsValidUrl = (url: string): boolean => {
  if (url.includes("https://excalidraw.com/")) {
    return true;
  }

  return false;
};

// Constants for project sorting
export const PROJECT_SORT_CONSTANTS = {
  TIME_THRESHOLD_MS: 86400000, // 1 day in milliseconds
  DEFAULT_PAGINATION_LIMIT: 5,
} as const;

// Constants for context menu submenu calculations
export const SUBMENU_CONSTANTS = {
  ITEM_HEIGHT: 40,
  PADDING: 16,
  MAX_HEIGHT: 400,
  SCROLLBAR_WIDTH: 6,
  SUBMENU_WIDTH: 200,
  MARGIN: 4,
} as const;

/**
 * Sorts projects using the optimal strategy:
 * 1. Projects with more canvases first (active projects)
 * 2. Recently updated projects first (if > 1 day difference)
 * 3. Alphabetical by name as tiebreaker
 */
export const sortProjectsByActivity = (
  projects: UnifiedProject[],
  getCanvasCount: (projectId: string) => number
): UnifiedProject[] => {
  return projects
    .slice() // Create a copy to avoid mutation
    .sort((a, b) => {
      // 1. Projects with more canvases first (active projects)
      const aCanvasCount = getCanvasCount(a.id);
      const bCanvasCount = getCanvasCount(b.id);
      
      if (aCanvasCount !== bCanvasCount) {
        return bCanvasCount - aCanvasCount; // More canvases first
      }
      
      // 2. Recently updated projects first
      const aDate = a.updatedAt || a.createdAt;
      const bDate = b.updatedAt || b.createdAt;
      const dateDiff = new Date(bDate).getTime() - new Date(aDate).getTime();
      
      if (Math.abs(dateDiff) > PROJECT_SORT_CONSTANTS.TIME_THRESHOLD_MS) {
        return dateDiff;
      }
      
      // 3. Alphabetical by name as tiebreaker
      return a.name.localeCompare(b.name);
    });
};

export const slugifyPathSegment = (name: string, fallback = "untitled"): string =>
  name
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;

export const makeUniquePathSegment = (
  usedSegments: Set<string>,
  desiredName: string,
  fallback = "untitled",
): string => {
  const base = slugifyPathSegment(desiredName, fallback);
  let candidate = base;
  let counter = 2;

  while (usedSegments.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }

  usedSegments.add(candidate);
  return candidate;
};

export const makeUniqueFilename = (
  usedFilenames: Set<string>,
  desiredBaseName: string,
  extension: string,
  fallbackBaseName = "untitled",
): string => {
  const normalizedExt = extension.startsWith(".") ? extension.slice(1) : extension;
  const base = slugifyPathSegment(desiredBaseName, fallbackBaseName);
  const suffix = normalizedExt ? `.${normalizedExt}` : "";

  let candidate = `${base}${suffix}`;
  let counter = 2;

  while (usedFilenames.has(candidate)) {
    candidate = `${base}_${counter}${suffix}`;
    counter += 1;
  }

  usedFilenames.add(candidate);
  return candidate;
};
