import { useEffect, useCallback } from 'react';
import { useUnifiedState } from '../context/UnifiedStateProvider';
import { eventBus, InternalEventTypes } from '../messaging/InternalEventBus';

interface KeyboardShortcutsProps {
  onNewCanvas: () => void;
  onNewProject: () => void;
  onTogglePanel?: () => void;
}

export function useKeyboardShortcuts({ 
  onNewCanvas, 
  onNewProject, 
  onTogglePanel 
}: KeyboardShortcutsProps) {
  const { state, dispatch } = useUnifiedState();

  // Check if user is currently typing in an input
  const isTyping = useCallback(() => {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.hasAttribute('contenteditable') ||
      activeElement.closest('[contenteditable]') ||
      // Check for Excalidraw canvas focus
      activeElement.closest('.excalidraw') ||
      activeElement.closest('.App-center')
    );
  }, []);

  // Handle canvas deletion
  const handleDeleteSelected = useCallback(() => {
    if (!state.selectedCanvasId) return;
    
    const selectedCanvas = state.canvases.find(c => c.id === state.selectedCanvasId);
    if (!selectedCanvas) return;

    if (confirm(`Are you sure you want to delete "${selectedCanvas.name}"?\n\nThis action cannot be undone.`)) {
      eventBus.emit(InternalEventTypes.CANVAS_DELETED, selectedCanvas);
      dispatch({ type: 'DELETE_CANVAS', payload: selectedCanvas.id });
      dispatch({ type: 'SET_SELECTED_CANVAS', payload: null });
    }
  }, [state.selectedCanvasId, state.canvases, dispatch]);

  // Handle canvas duplication
  const handleDuplicateSelected = useCallback(() => {
    if (!state.selectedCanvasId) return;
    
    const canvas = state.canvases.find(c => c.id === state.selectedCanvasId);
    if (!canvas) return;

    const newCanvas = {
      ...canvas,
      id: `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${canvas.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: undefined // Remove from project on duplicate
    };
    
    eventBus.emit(InternalEventTypes.CANVAS_CREATED, newCanvas);
    dispatch({ type: 'ADD_CANVAS', payload: newCanvas });
    dispatch({ type: 'SET_SELECTED_CANVAS', payload: newCanvas.id });
  }, [state.selectedCanvasId, state.canvases, dispatch]);

  // Handle canvas rename
  const handleRenameSelected = useCallback(() => {
    if (!state.selectedCanvasId) return;
    
    const selectedCanvas = state.canvases.find(c => c.id === state.selectedCanvasId);
    if (!selectedCanvas) return;

    const newName = prompt('Enter new name:', selectedCanvas.name);
    if (newName && newName.trim() !== selectedCanvas.name) {
      const updatedCanvas = { 
        ...selectedCanvas, 
        name: newName.trim(), 
        updatedAt: new Date() 
      };
      
      eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);
      dispatch({ type: 'UPDATE_CANVAS', payload: updatedCanvas });
    }
  }, [state.selectedCanvasId, state.canvases, dispatch]);

  // Navigate between canvases
  const handleNavigateCanvases = useCallback((direction: 'next' | 'prev') => {
    const visibleCanvases = state.canvases.filter(() => {
      // Include all canvases that are visible in the current view
      return true; // For now, include all canvases
    }).sort((a, b) => {
      // Sort by updated date (most recent first)
      return new Date(b.updatedAt || b.createdAt).getTime() - 
             new Date(a.updatedAt || a.createdAt).getTime();
    });

    if (visibleCanvases.length === 0) return;

    let currentIndex = -1;
    if (state.selectedCanvasId) {
      currentIndex = visibleCanvases.findIndex(c => c.id === state.selectedCanvasId);
    }

    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex < visibleCanvases.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : visibleCanvases.length - 1;
    }

    const nextCanvas = visibleCanvases[newIndex];
    if (nextCanvas) {
      dispatch({ type: 'SET_SELECTED_CANVAS', payload: nextCanvas.id });
      eventBus.emit(InternalEventTypes.CANVAS_SELECTED, nextCanvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, nextCanvas);
    }
  }, [state.canvases, state.selectedCanvasId, dispatch]);

  // Main keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing
      if (isTyping()) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const shiftKey = e.shiftKey;

      // Search modal - Cmd/Ctrl + P
      if (modKey && e.key === 'p') {
        e.preventDefault();
        dispatch({ type: 'SET_SEARCH_MODAL_OPEN', payload: true });
        return;
      }

      // New canvas - Cmd/Ctrl + N
      if (modKey && e.key === 'n' && !shiftKey) {
        e.preventDefault();
        onNewCanvas();
        return;
      }

      // New project - Cmd/Ctrl + Shift + N
      if (modKey && shiftKey && e.key === 'N') {
        e.preventDefault();
        onNewProject();
        return;
      }

      // Toggle panel visibility - Cmd/Ctrl + B
      if (modKey && e.key === 'b') {
        e.preventDefault();
        if (onTogglePanel) {
          onTogglePanel();
        }
        return;
      }

      // Duplicate canvas - Cmd/Ctrl + D
      if (modKey && e.key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Delete selected canvas - Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Rename selected canvas - F2
      if (e.key === 'F2') {
        e.preventDefault();
        handleRenameSelected();
        return;
      }

      // Navigate between canvases - Cmd/Ctrl + Arrow keys
      if (modKey && e.key === 'ArrowDown') {
        e.preventDefault();
        handleNavigateCanvases('next');
        return;
      }

      if (modKey && e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigateCanvases('prev');
        return;
      }

      // Close modals - Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        
        // Priority order: context menu > search modal > other modals
        if (state.contextMenu) {
          dispatch({ type: 'SET_CONTEXT_MENU', payload: null });
        } else if (state.isSearchModalOpen) {
          dispatch({ type: 'SET_SEARCH_MODAL_OPEN', payload: false });
        }
        
        // Emit escape event for other components to handle
        eventBus.emit(InternalEventTypes.ESCAPE_PRESSED, null);
        return;
      }

      // Toggle theme - Cmd/Ctrl + Shift + T
      if (modKey && shiftKey && e.key === 'T') {
        e.preventDefault();
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        dispatch({ type: 'SET_THEME', payload: newTheme });
        eventBus.emit(InternalEventTypes.THEME_CHANGED, newTheme);
        return;
      }

      // Quick actions with numbers - Cmd/Ctrl + 1-9
      if (modKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const recentCanvases = state.canvases
          .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - 
                         new Date(a.updatedAt || a.createdAt).getTime())
          .slice(0, 9);
        
        const canvas = recentCanvases[index];
        if (canvas) {
          dispatch({ type: 'SET_SELECTED_CANVAS', payload: canvas.id });
          eventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);
          eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, canvas);
        }
        return;
      }

      // Select all canvases - Cmd/Ctrl + A (for future bulk operations)
      if (modKey && e.key === 'a') {
        // Don't prevent default here as Excalidraw might need it
        // For now, just emit an event that could be used for bulk selection
        eventBus.emit(InternalEventTypes.SELECT_ALL_REQUEST, null);
        return;
      }

      // Help overlay - F1 or Cmd/Ctrl + /
      if (e.key === 'F1' || (modKey && e.key === '/')) {
        e.preventDefault();
        eventBus.emit(InternalEventTypes.SHOW_HELP_OVERLAY, null);
        return;
      }

      // Refresh panel data - F5 or Cmd/Ctrl + R
      if (e.key === 'F5' || (modKey && e.key === 'r')) {
        e.preventDefault();
        eventBus.emit(InternalEventTypes.REFRESH_DATA, null);
        return;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    state.contextMenu,
    state.isSearchModalOpen,
    state.theme,
    state.canvases,
    state.selectedCanvasId,
    isTyping,
    dispatch,
    onNewCanvas,
    onNewProject,
    onTogglePanel,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRenameSelected,
    handleNavigateCanvases
  ]);

  // Return information about available shortcuts for help overlay
  return {
    shortcuts: {
      'Search': 'Cmd/Ctrl + P',
      'New Canvas': 'Cmd/Ctrl + N',
      'New Project': 'Cmd/Ctrl + Shift + N',
      'Toggle Panel': 'Cmd/Ctrl + B',
      'Duplicate Canvas': 'Cmd/Ctrl + D',
      'Delete Canvas': 'Delete/Backspace',
      'Rename Canvas': 'F2',
      'Navigate Canvases': 'Cmd/Ctrl + ↑/↓',
      'Quick Select': 'Cmd/Ctrl + 1-9',
      'Toggle Theme': 'Cmd/Ctrl + Shift + T',
      'Close Modals': 'Escape',
      'Help': 'F1 or Cmd/Ctrl + /',
      'Refresh': 'F5 or Cmd/Ctrl + R'
    }
  };
}