import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUnifiedState } from '../context/UnifiedStateProvider';
import { UnifiedCanvas } from '../../shared/types';
import { globalEventBus, InternalEventTypes } from '../messaging/InternalEventBus';

interface Props {
  onNewCanvas: () => void;
  onCanvasSelect: (canvas: UnifiedCanvas) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

// Simple icons as fallbacks (can be replaced with icon library later)
const Icons = {
  Plus: () => <span style={{ fontSize: '16px' }}>+</span>,
  Search: () => <span style={{ fontSize: '16px' }}>🔍</span>,
  Pin: () => <span style={{ fontSize: '16px' }}>📌</span>,
  PinOff: () => <span style={{ fontSize: '16px' }}>📍</span>,
  ChevronDown: () => <span style={{ fontSize: '14px' }}>▼</span>,
  ChevronRight: () => <span style={{ fontSize: '14px' }}>▶</span>,
  FileText: ({ size = 16 }: { size?: number }) => <span style={{ fontSize: `${size}px` }}>📄</span>,
  Folder: () => <span style={{ fontSize: '16px' }}>📁</span>,
  FolderPlus: () => <span style={{ fontSize: '16px' }}>📁+</span>,
};

export function AutoHidePanel({ onNewCanvas, onCanvasSelect }: Props) {
  const { state, dispatch, updatePanelSettings, getCanvasesForProject, getUnorganizedCanvases } = useUnifiedState();
  const [isResizing, setIsResizing] = useState(false);
  const [showWidthIndicator, setShowWidthIndicator] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number>();
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.8);
      if (state.panelWidth > maxAllowedWidth) {
        updatePanelSettings({ width: maxAllowedWidth });
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [state.panelWidth, updatePanelSettings]);

  // Keyboard shortcuts for resizing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isPanelVisible || !state.isPanelPinned) return;
      
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -20 : 20;
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, state.panelWidth + delta));
        updatePanelSettings({ width: newWidth });
        setShowWidthIndicator(true);
        setTimeout(() => setShowWidthIndicator(false), 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isPanelVisible, state.isPanelPinned, state.panelWidth, updatePanelSettings]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    dispatch({ type: 'SET_PANEL_VISIBLE', payload: true });
    globalEventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, { isVisible: true });
  };

  const handleMouseLeave = () => {
    if (!state.isPanelPinned && !isResizing) {
      timeoutRef.current = setTimeout(() => {
        dispatch({ type: 'SET_PANEL_VISIBLE', payload: false });
        globalEventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, { isVisible: false });
      }, 300);
    }
  };

  const togglePin = () => {
    const newPinned = !state.isPanelPinned;
    dispatch({ type: 'SET_PANEL_PINNED', payload: newPinned });
    updatePanelSettings({ isPinned: newPinned });
    
    if (newPinned) {
      dispatch({ type: 'SET_PANEL_VISIBLE', payload: true });
      globalEventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, { isVisible: true });
    }
    
    globalEventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, { isPinned: newPinned });
  };

  // Mouse resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setShowWidthIndicator(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = state.panelWidth;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [state.panelWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartX.current;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth.current + deltaX));
    dispatch({ type: 'SET_PANEL_WIDTH', payload: newWidth });
  }, [isResizing, dispatch]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Save the final width
    updatePanelSettings({ width: state.panelWidth });
    
    setTimeout(() => setShowWidthIndicator(false), 1000);
    globalEventBus.emit(InternalEventTypes.PANEL_WIDTH_CHANGED, { width: state.panelWidth });
  }, [state.panelWidth, updatePanelSettings]);

  // Event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const toggleProject = (projectId: string) => {
    dispatch({ type: 'TOGGLE_PROJECT_COLLAPSED', payload: projectId });
    
    // Save collapsed projects state
    const collapsedArray = Array.from(state.collapsedProjects);
    updatePanelSettings({ collapsedProjects: collapsedArray });
  };

  const handleCanvasRightClick = (e: React.MouseEvent, canvas: UnifiedCanvas) => {
    e.preventDefault();
    dispatch({
      type: 'SET_CONTEXT_MENU',
      payload: { x: e.clientX, y: e.clientY, canvas }
    });
    globalEventBus.emit(InternalEventTypes.SHOW_CONTEXT_MENU, { 
      x: e.clientX, 
      y: e.clientY, 
      canvas 
    });
  };

  const handleCanvasSelect = (canvas: UnifiedCanvas) => {
    dispatch({ type: 'SET_SELECTED_CANVAS', payload: canvas.id });
    onCanvasSelect(canvas);
    globalEventBus.emit(InternalEventTypes.CANVAS_SELECTED, { canvas });
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Inline styles for content script (avoiding external CSS dependencies)
  const styles = {
    container: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 999999,
      pointerEvents: 'none' as const,
    },
    trigger: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '10px',
      height: '100vh',
      pointerEvents: 'all' as const,
      zIndex: 1,
    },
    panel: {
      position: 'relative' as const,
      width: `${state.panelWidth}px`,
      height: '100vh',
      background: state.theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(35, 35, 41, 0.95)',
      backdropFilter: 'blur(8px)',
      borderRight: `1px solid ${state.theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
      color: state.theme === 'light' ? '#1e1e1e' : '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      display: 'flex',
      flexDirection: 'column' as const,
      pointerEvents: 'all' as const,
      transform: (state.isPanelVisible || state.isPanelPinned) ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    resizeHandle: {
      position: 'absolute' as const,
      top: 0,
      right: 0,
      width: '4px',
      height: '100%',
      cursor: 'col-resize',
      backgroundColor: 'transparent',
      borderRight: `2px solid ${state.theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
    },
    widthIndicator: {
      position: 'absolute' as const,
      top: '50%',
      right: '10px',
      transform: 'translateY(-50%)',
      background: state.theme === 'light' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      color: state.theme === 'light' ? '#ffffff' : '#000000',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      opacity: showWidthIndicator ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: 'none' as const,
    },
    header: {
      padding: '16px',
      borderBottom: `1px solid ${state.theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
      flexShrink: 0,
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
    },
    title: {
      fontSize: '16px',
      fontWeight: '600',
      margin: 0,
    },
    button: {
      background: state.theme === 'light' ? '#007aff' : '#0066cc',
      color: '#ffffff',
      border: 'none',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      width: '100%',
      marginBottom: '8px',
      transition: 'background-color 0.2s ease',
    },
    pinButton: {
      background: 'transparent',
      border: 'none',
      color: state.theme === 'light' ? '#666666' : '#cccccc',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      opacity: state.isPanelPinned ? 1 : 0.6,
    },
    content: {
      flex: 1,
      overflow: 'auto',
      padding: '0 16px 16px',
    },
    section: {
      marginBottom: '24px',
    },
    sectionHeader: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      color: state.theme === 'light' ? '#666666' : '#999999',
      marginBottom: '8px',
      letterSpacing: '0.5px',
    },
    projectItem: {
      marginBottom: '8px',
    },
    projectHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      backgroundColor: state.theme === 'light' ? 'transparent' : 'transparent',
    },
    canvasItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      backgroundColor: state.theme === 'light' ? 'transparent' : 'transparent',
      marginLeft: '20px',
    },
    canvasThumbnail: {
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    canvasName: {
      flex: 1,
      fontWeight: '500',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    canvasDate: {
      fontSize: '12px',
      color: state.theme === 'light' ? '#666666' : '#999999',
      flexShrink: 0,
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '32px 16px',
      color: state.theme === 'light' ? '#666666' : '#999999',
    },
  };

  return (
    <div style={styles.container}>
      {/* Trigger area */}
      <div 
        style={styles.trigger}
        onMouseEnter={handleMouseEnter}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={styles.panel}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Resize Handle */}
        <div
          style={styles.resizeHandle}
          onMouseDown={handleResizeStart}
          title="Drag to resize panel"
        />

        {/* Width Indicator */}
        <div style={styles.widthIndicator}>
          {state.panelWidth}px
        </div>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <h2 style={styles.title}>Excalidraw</h2>
            <button 
              style={styles.pinButton}
              onClick={togglePin}
              title={state.isPanelPinned ? 'Unpin panel' : 'Pin panel'}
            >
              {state.isPanelPinned ? <Icons.Pin /> : <Icons.PinOff />}
            </button>
          </div>
          
          <button 
            style={styles.button}
            onClick={onNewCanvas}
          >
            <Icons.Plus />
            <span>New Canvas</span>
          </button>

          <button 
            style={styles.button}
            onClick={() => {
              // TODO: Implement project modal in Phase 3
              console.log('Project creation not yet implemented');
            }}
          >
            <Icons.FolderPlus />
            <span>New Project</span>
          </button>
          
          <button 
            style={styles.button}
            onClick={() => dispatch({ type: 'TOGGLE_SEARCH_MODAL' })}
          >
            <Icons.Search />
            <span>Search canvases...</span>
            <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.7 }}>⌘P</span>
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Projects Section */}
          {state.projects.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span>Projects</span>
              </div>
              
              {state.projects.map(project => {
                const projectCanvases = getCanvasesForProject(project.id);
                const isCollapsed = state.collapsedProjects.has(project.id);
                
                return (
                  <div key={project.id} style={styles.projectItem}>
                    <div 
                      style={styles.projectHeader}
                      onClick={() => toggleProject(project.id)}
                    >
                      {isCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
                      <div 
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '2px',
                          backgroundColor: project.color,
                          flexShrink: 0,
                        }}
                      />
                      <Icons.Folder />
                      <span style={styles.canvasName}>{project.name}</span>
                      <span style={styles.canvasDate}>{projectCanvases.length}</span>
                    </div>
                    
                    {!isCollapsed && (
                      <div>
                        {projectCanvases.map(canvas => (
                          <div
                            key={canvas.id}
                            style={{
                              ...styles.canvasItem,
                              backgroundColor: state.selectedCanvasId === canvas.id ? 
                                (state.theme === 'light' ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 102, 204, 0.2)') : 
                                'transparent'
                            }}
                            onClick={() => handleCanvasSelect(canvas)}
                            onContextMenu={(e) => handleCanvasRightClick(e, canvas)}
                          >
                            <div style={styles.canvasThumbnail}>
                              <Icons.FileText size={12} />
                            </div>
                            <span style={styles.canvasName}>{canvas.name}</span>
                            <span style={styles.canvasDate}>
                              {formatDate(canvas.updatedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Canvases Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span>Recent</span>
            </div>
            
            {getUnorganizedCanvases().length > 0 ? (
              getUnorganizedCanvases()
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .map(canvas => (
                  <div
                    key={canvas.id}
                    style={{
                      ...styles.canvasItem,
                      backgroundColor: state.selectedCanvasId === canvas.id ? 
                        (state.theme === 'light' ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 102, 204, 0.2)') : 
                        'transparent'
                    }}
                    onClick={() => handleCanvasSelect(canvas)}
                    onContextMenu={(e) => handleCanvasRightClick(e, canvas)}
                  >
                    <div style={styles.canvasThumbnail}>
                      <Icons.FileText size={12} />
                    </div>
                    <span style={styles.canvasName}>{canvas.name}</span>
                    <span style={styles.canvasDate}>
                      {formatDate(canvas.updatedAt)}
                    </span>
                  </div>
                ))
            ) : (
              <div style={styles.emptyState}>
                <Icons.FileText size={48} />
                <div style={{ marginTop: '12px', fontWeight: '500' }}>No canvases yet</div>
                <div style={{ marginTop: '4px', fontSize: '12px' }}>
                  Create your first canvas to get started
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}