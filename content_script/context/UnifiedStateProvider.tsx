import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  UnifiedCanvas, 
  UnifiedProject, 
  SearchResult, 
  ContextMenuData 
} from '../../shared/types';
import {
  canvasOperations,
  projectOperations,
  settingsOperations,
  dbUtils
} from '../../shared/unified-db';

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
  theme: 'light' | 'dark';
  
  // Panel state
  isPanelVisible: boolean;
  isPanelPinned: boolean;
  panelWidth: number;
  collapsedProjects: Set<string>;
  
  // Loading and error state
  isLoading: boolean;
  error: string | null;
  dbError: boolean;
}

type UnifiedAction =
  // Data operations
  | { type: 'SET_PROJECTS'; payload: UnifiedProject[] }
  | { type: 'SET_CANVASES'; payload: UnifiedCanvas[] }
  | { type: 'ADD_CANVAS'; payload: UnifiedCanvas }
  | { type: 'UPDATE_CANVAS'; payload: UnifiedCanvas }
  | { type: 'DELETE_CANVAS'; payload: string }
  | { type: 'ADD_PROJECT'; payload: UnifiedProject }
  | { type: 'UPDATE_PROJECT'; payload: UnifiedProject }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_CURRENT_WORKING_CANVAS'; payload: string | null }
  
  // Search operations
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResult[] }
  | { type: 'TOGGLE_SEARCH_MODAL' }
  | { type: 'SET_SEARCH_MODAL'; payload: boolean }
  
  // UI operations
  | { type: 'SET_SELECTED_CANVAS'; payload: string | null }
  | { type: 'SET_CONTEXT_MENU'; payload: ContextMenuData | null }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'TOGGLE_THEME' }
  
  // Panel operations
  | { type: 'SET_PANEL_VISIBLE'; payload: boolean }
  | { type: 'SET_PANEL_PINNED'; payload: boolean }
  | { type: 'SET_PANEL_WIDTH'; payload: number }
  | { type: 'TOGGLE_PROJECT_COLLAPSED'; payload: string }
  | { type: 'SET_COLLAPSED_PROJECTS'; payload: Set<string> }
  
  // System operations
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DB_ERROR'; payload: boolean }
  | { type: 'ADD_CANVAS_TO_PROJECT'; payload: { canvasId: string; projectId: string } }
  | { type: 'REMOVE_CANVAS_FROM_PROJECT'; payload: { canvasId: string; projectId: string } };

const initialState: UnifiedState = {
  // Core data
  projects: [],
  canvases: [],
  currentWorkingCanvasId: null,
  
  // Search state
  searchQuery: '',
  searchResults: [],
  isSearchModalOpen: false,
  
  // UI state
  selectedCanvasId: null,
  contextMenu: null,
  theme: 'dark',
  
  // Panel state
  isPanelVisible: false,
  isPanelPinned: false,
  panelWidth: 320,
  collapsedProjects: new Set(),
  
  // Loading and error state
  isLoading: false,
  error: null,
  dbError: false,
};

function unifiedStateReducer(state: UnifiedState, action: UnifiedAction): UnifiedState {
  switch (action.type) {
    // Data operations
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    
    case 'SET_CANVASES':
      return { ...state, canvases: action.payload };
    
    case 'ADD_CANVAS':
      return { 
        ...state, 
        canvases: [action.payload, ...state.canvases],
        currentWorkingCanvasId: action.payload.id
      };
    
    case 'UPDATE_CANVAS':
      return {
        ...state,
        canvases: state.canvases.map(canvas =>
          canvas.id === action.payload.id ? action.payload : canvas
        ),
      };
    
    case 'DELETE_CANVAS':
      return {
        ...state,
        canvases: state.canvases.filter(canvas => canvas.id !== action.payload),
        projects: state.projects.map(project => ({
          ...project,
          canvasIds: project.canvasIds.filter(id => id !== action.payload),
        })),
        selectedCanvasId: state.selectedCanvasId === action.payload ? null : state.selectedCanvasId,
        currentWorkingCanvasId: state.currentWorkingCanvasId === action.payload ? null : state.currentWorkingCanvasId,
      };
    
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload.id ? action.payload : project
        ),
      };
    
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload),
        canvases: state.canvases.map(canvas =>
          canvas.projectId === action.payload ? { ...canvas, projectId: undefined } : canvas
        ),
        collapsedProjects: new Set([...state.collapsedProjects].filter(id => id !== action.payload)),
      };
    
    case 'SET_CURRENT_WORKING_CANVAS':
      return { ...state, currentWorkingCanvasId: action.payload };
    
    // Search operations
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    
    case 'TOGGLE_SEARCH_MODAL':
      return { ...state, isSearchModalOpen: !state.isSearchModalOpen };
    
    case 'SET_SEARCH_MODAL':
      return { ...state, isSearchModalOpen: action.payload };
    
    // UI operations
    case 'SET_SELECTED_CANVAS':
      return { ...state, selectedCanvasId: action.payload };
    
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.payload };
    
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    
    // Panel operations
    case 'SET_PANEL_VISIBLE':
      return { ...state, isPanelVisible: action.payload };
    
    case 'SET_PANEL_PINNED':
      return { ...state, isPanelPinned: action.payload };
    
    case 'SET_PANEL_WIDTH':
      return { ...state, panelWidth: action.payload };
    
    case 'TOGGLE_PROJECT_COLLAPSED':
      const newCollapsed = new Set(state.collapsedProjects);
      if (newCollapsed.has(action.payload)) {
        newCollapsed.delete(action.payload);
      } else {
        newCollapsed.add(action.payload);
      }
      return { ...state, collapsedProjects: newCollapsed };
    
    case 'SET_COLLAPSED_PROJECTS':
      return { ...state, collapsedProjects: action.payload };
    
    // System operations
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_DB_ERROR':
      return { ...state, dbError: action.payload };
    
    case 'ADD_CANVAS_TO_PROJECT':
      return {
        ...state,
        canvases: state.canvases.map(canvas =>
          canvas.id === action.payload.canvasId
            ? { ...canvas, projectId: action.payload.projectId }
            : canvas
        ),
        projects: state.projects.map(project =>
          project.id === action.payload.projectId
            ? { ...project, canvasIds: [...project.canvasIds, action.payload.canvasId] }
            : project
        ),
      };
    
    case 'REMOVE_CANVAS_FROM_PROJECT':
      return {
        ...state,
        canvases: state.canvases.map(canvas =>
          canvas.id === action.payload.canvasId
            ? { ...canvas, projectId: undefined }
            : canvas
        ),
        projects: state.projects.map(project =>
          project.id === action.payload.projectId
            ? { ...project, canvasIds: project.canvasIds.filter(id => id !== action.payload.canvasId) }
            : project
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
  createCanvas: (canvas: Omit<UnifiedCanvas, 'id' | 'createdAt' | 'updatedAt'>) => Promise<UnifiedCanvas>;
  removeCanvas: (canvasId: string) => Promise<void>;
  saveProject: (project: UnifiedProject) => Promise<void>;
  createProject: (project: Omit<UnifiedProject, 'id' | 'createdAt'>) => Promise<UnifiedProject>;
  removeProject: (projectId: string) => Promise<void>;
  updatePanelSettings: (settings: Partial<{ isPinned: boolean; width: number; collapsedProjects: string[] }>) => Promise<void>;
  getCanvasesForProject: (projectId: string) => UnifiedCanvas[];
  getUnorganizedCanvases: () => UnifiedCanvas[];
}

const UnifiedStateContext = createContext<UnifiedStateContextType | null>(null);

// Provider component
export function UnifiedStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(unifiedStateReducer, initialState);

  // Initialize data and settings from IndexedDB
  const loadInitialData = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Check database accessibility
      const dbAccessible = await dbUtils.isAccessible();
      if (!dbAccessible) {
        dispatch({ type: 'SET_DB_ERROR', payload: true });
        dispatch({ type: 'SET_ERROR', payload: 'Unable to access database. Some features may not work.' });
        return;
      }

      // Load data in parallel
      const [projects, canvases, panelSettings] = await Promise.all([
        projectOperations.getAllProjects(),
        canvasOperations.getAllCanvases(),
        loadPanelSettings()
      ]);

      dispatch({ type: 'SET_PROJECTS', payload: projects });
      dispatch({ type: 'SET_CANVASES', payload: canvases });
      
      // Apply panel settings
      dispatch({ type: 'SET_PANEL_PINNED', payload: panelSettings.isPinned });
      dispatch({ type: 'SET_PANEL_WIDTH', payload: panelSettings.width });
      dispatch({ type: 'SET_COLLAPSED_PROJECTS', payload: new Set(panelSettings.collapsedProjects) });

      // Load current working canvas
      const currentCanvasId = await settingsOperations.getSetting('currentWorkingCanvasId');
      if (currentCanvasId && typeof currentCanvasId === 'string') {
        dispatch({ type: 'SET_CURRENT_WORKING_CANVAS', payload: currentCanvasId });
      }

    } catch (error) {
      console.error('Failed to load initial data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load data from database.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Load panel settings from IndexedDB
  const loadPanelSettings = async () => {
    const [isPinned, width, collapsedProjectsStr] = await Promise.all([
      settingsOperations.getSetting('panelIsPinned'),
      settingsOperations.getSetting('panelWidth'),
      settingsOperations.getSetting('collapsedProjects')
    ]);

    return {
      isPinned: isPinned === true,
      width: typeof width === 'number' ? Math.max(200, Math.min(600, width)) : 320,
      collapsedProjects: Array.isArray(collapsedProjectsStr) ? collapsedProjectsStr : []
    };
  };

  // Save canvas with database sync
  const saveCanvas = useCallback(async (canvas: UnifiedCanvas) => {
    try {
      await canvasOperations.updateCanvas(canvas);
      dispatch({ type: 'UPDATE_CANVAS', payload: canvas });
    } catch (error) {
      console.error('Failed to save canvas:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save canvas.' });
      throw error;
    }
  }, []);

  // Create new canvas
  const createCanvas = useCallback(async (canvasData: Omit<UnifiedCanvas, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = new Date();
      const canvas: UnifiedCanvas = {
        ...canvasData,
        id: `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,  
        updatedAt: now,
        lastModified: now.toISOString(),
        excalidraw: canvasData.elements || [], // Backward compatibility
      };
      
      await canvasOperations.addCanvas(canvas);
      dispatch({ type: 'ADD_CANVAS', payload: canvas });
      return canvas;
    } catch (error) {
      console.error('Failed to create canvas:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create canvas.' });
      throw error;
    }
  }, []);

  // Remove canvas
  const removeCanvas = useCallback(async (canvasId: string) => {
    try {
      await canvasOperations.deleteCanvas(canvasId);
      dispatch({ type: 'DELETE_CANVAS', payload: canvasId });
    } catch (error) {
      console.error('Failed to delete canvas:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete canvas.' });
      throw error;
    }
  }, []);

  // Save project with database sync
  const saveProject = useCallback(async (project: UnifiedProject) => {
    try {
      await projectOperations.updateProject(project);
      dispatch({ type: 'UPDATE_PROJECT', payload: project });
    } catch (error) {
      console.error('Failed to save project:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save project.' });
      throw error;
    }
  }, []);

  // Create new project
  const createProject = useCallback(async (projectData: Omit<UnifiedProject, 'id' | 'createdAt'>) => {
    try {
      const project: UnifiedProject = {
        ...projectData,
        id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        canvasIds: projectData.canvasIds || [],
        fileIds: projectData.canvasIds || [], // Backward compatibility
      };
      
      await projectOperations.addProject(project);
      dispatch({ type: 'ADD_PROJECT', payload: project });
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create project.' });
      throw error;
    }
  }, []);

  // Remove project
  const removeProject = useCallback(async (projectId: string) => {
    try {
      await projectOperations.deleteProject(projectId);
      dispatch({ type: 'DELETE_PROJECT', payload: projectId });
    } catch (error) {
      console.error('Failed to delete project:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete project.' });
      throw error;
    }
  }, []);

  // Update panel settings
  const updatePanelSettings = useCallback(async (settings: Partial<{ isPinned: boolean; width: number; collapsedProjects: string[] }>) => {
    try {
      const promises: Promise<void>[] = [];
      
      if (settings.isPinned !== undefined) {
        promises.push(settingsOperations.setSetting('panelIsPinned', settings.isPinned));
        dispatch({ type: 'SET_PANEL_PINNED', payload: settings.isPinned });
      }
      
      if (settings.width !== undefined) {
        promises.push(settingsOperations.setSetting('panelWidth', settings.width));
        dispatch({ type: 'SET_PANEL_WIDTH', payload: settings.width });
      }
      
      if (settings.collapsedProjects !== undefined) {
        promises.push(settingsOperations.setSetting('collapsedProjects', settings.collapsedProjects));
        dispatch({ type: 'SET_COLLAPSED_PROJECTS', payload: new Set(settings.collapsedProjects) });
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to save panel settings:', error);
    }
  }, []);

  // Convenience functions for canvas filtering
  const getCanvasesForProject = useCallback((projectId: string) => {
    return state.canvases.filter(canvas => canvas.projectId === projectId);
  }, [state.canvases]);

  const getUnorganizedCanvases = useCallback(() => {
    return state.canvases.filter(canvas => !canvas.projectId);
  }, [state.canvases]);

  // Auto-save current working canvas ID
  useEffect(() => {
    if (state.currentWorkingCanvasId) {
      settingsOperations.setSetting('currentWorkingCanvasId', state.currentWorkingCanvasId).catch(console.error);
    }
  }, [state.currentWorkingCanvasId]);

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
    throw new Error('useUnifiedState must be used within a UnifiedStateProvider');
  }
  return context;
}

// Export types for use in components
export type { UnifiedState, UnifiedAction, UnifiedStateContextType };