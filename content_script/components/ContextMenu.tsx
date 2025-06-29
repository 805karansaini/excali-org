import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3,
  Trash2,
  Copy,
  FolderPlus,
  Download,
  ChevronRight,
  Move
} from 'lucide-react';
import { useUnifiedState } from '../context/UnifiedStateProvider';
import { eventBus, InternalEventTypes } from '../messaging/InternalEventBus';
import { UnifiedCanvas, UnifiedProject } from '../../shared/types';

interface Props {
  x: number;
  y: number;
  canvas: UnifiedCanvas;
  onClose: () => void;
}

export function ContextMenu({ x, y, canvas, onClose }: Props) {
  const { state, dispatch } = useUnifiedState();
  const [showAddToProject, setShowAddToProject] = useState(false);
  const [showMoveToProject, setShowMoveToProject] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position menu to stay within viewport
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 16) {
        adjustedX = viewportWidth - rect.width - 16;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight - 16) {
        adjustedY = viewportHeight - rect.height - 16;
      }

      // Ensure menu is not off-screen on the left or top
      adjustedX = Math.max(16, adjustedX);
      adjustedY = Math.max(16, adjustedY);

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Delay adding listeners to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleRename = () => {
    const newName = prompt('Enter new name:', canvas.name);
    if (newName && newName.trim() !== canvas.name) {
      const updatedCanvas = {
        ...canvas,
        name: newName.trim(),
        updatedAt: new Date()
      };

      eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);
      dispatch({ type: 'UPDATE_CANVAS', payload: updatedCanvas });
    }
    onClose();
  };

  const handleDuplicate = () => {
    const newCanvas: UnifiedCanvas = {
      ...canvas,
      id: `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${canvas.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: undefined // Remove from project on duplicate
    };

    eventBus.emit(InternalEventTypes.CANVAS_CREATED, newCanvas);
    dispatch({ type: 'ADD_CANVAS', payload: newCanvas });
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${canvas.name}"?\n\nThis action cannot be undone.`)) {
      eventBus.emit(InternalEventTypes.CANVAS_DELETED, canvas);
      dispatch({ type: 'DELETE_CANVAS', payload: canvas.id });

      // If this was the selected canvas, clear selection
      if (state.selectedCanvasId === canvas.id) {
        dispatch({ type: 'SET_SELECTED_CANVAS', payload: null });
      }
    }
    onClose();
  };

  const handleAddToProject = (projectId: string) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    // Update project's canvas list
    const updatedProject: UnifiedProject = {
      ...project,
      canvasIds: [...(project.canvasIds || []), canvas.id],
      fileIds: [...(project.fileIds || []), canvas.id], // Backward compatibility
      updatedAt: new Date()
    };

    // Update canvas with project reference
    const updatedCanvas: UnifiedCanvas = {
      ...canvas,
      projectId,
      updatedAt: new Date()
    };

    eventBus.emit(InternalEventTypes.PROJECT_UPDATED, updatedProject);
    eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);

    dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
    dispatch({ type: 'UPDATE_CANVAS', payload: updatedCanvas });

    onClose();
  };

  const handleMoveToProject = (projectId: string) => {
    const targetProject = state.projects.find(p => p.id === projectId);
    if (!targetProject) return;

    // Remove from current project if any
    if (canvas.projectId) {
      const currentProject = state.projects.find(p => p.id === canvas.projectId);
      if (currentProject) {
        const updatedCurrentProject: UnifiedProject = {
          ...currentProject,
          canvasIds: (currentProject.canvasIds || []).filter(id => id !== canvas.id),
          fileIds: (currentProject.fileIds || []).filter(id => id !== canvas.id),
          updatedAt: new Date()
        };

        eventBus.emit(InternalEventTypes.PROJECT_UPDATED, updatedCurrentProject);
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedCurrentProject });
      }
    }

    // Add to new project
    const updatedTargetProject: UnifiedProject = {
      ...targetProject,
      canvasIds: [...(targetProject.canvasIds || []), canvas.id],
      fileIds: [...(targetProject.fileIds || []), canvas.id],
      updatedAt: new Date()
    };

    const updatedCanvas: UnifiedCanvas = {
      ...canvas,
      projectId,
      updatedAt: new Date()
    };

    eventBus.emit(InternalEventTypes.PROJECT_UPDATED, updatedTargetProject);
    eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);

    dispatch({ type: 'UPDATE_PROJECT', payload: updatedTargetProject });
    dispatch({ type: 'UPDATE_CANVAS', payload: updatedCanvas });

    onClose();
  };

  const handleRemoveFromProject = () => {
    if (!canvas.projectId) return;

    const project = state.projects.find(p => p.id === canvas.projectId);
    if (!project) return;

    const updatedProject: UnifiedProject = {
      ...project,
      canvasIds: (project.canvasIds || []).filter(id => id !== canvas.id),
      fileIds: (project.fileIds || []).filter(id => id !== canvas.id),
      updatedAt: new Date()
    };

    const updatedCanvas: UnifiedCanvas = {
      ...canvas,
      projectId: undefined,
      updatedAt: new Date()
    };

    eventBus.emit(InternalEventTypes.PROJECT_UPDATED, updatedProject);
    eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);

    dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
    dispatch({ type: 'UPDATE_CANVAS', payload: updatedCanvas });

    onClose();
  };

  const handleDownload = () => {
    try {
      const exportData = {
        name: canvas.name,
        elements: canvas.elements || canvas.excalidraw || [],
        appState: canvas.appState || {},
        metadata: {
          id: canvas.id,
          createdAt: canvas.createdAt,
          updatedAt: canvas.updatedAt,
          projectId: canvas.projectId
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${canvas.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.excalidraw`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading canvas:', error);
      alert('Failed to download canvas. Please try again.');
    }
    onClose();
  };

  const handleLoadCanvas = () => {
    eventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);
    eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, canvas);
    dispatch({ type: 'SET_SELECTED_CANVAS', payload: canvas.id });
    onClose();
  };

  // Get available projects for adding/moving
  const availableProjectsForAdd = state.projects.filter(project =>
    !(project.canvasIds || []).includes(canvas.id) &&
    !(project.fileIds || []).includes(canvas.id)
  );

  const availableProjectsForMove = state.projects.filter(project =>
    project.id !== canvas.projectId
  );

  const currentProject = canvas.projectId
    ? state.projects.find(p => p.id === canvas.projectId)
    : null;

  const menuStyles: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    background: 'var(--theme-bg-secondary)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--theme-border-primary)',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    minWidth: '200px',
    padding: '8px 0',
    zIndex: 9999999,
    pointerEvents: 'auto'
  };

  const menuItemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    color: 'var(--theme-text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease'
  };

  const submenuStyles: React.CSSProperties = {
    position: 'absolute',
    left: '100%',
    top: 0,
    background: 'var(--theme-bg-secondary)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--theme-border-primary)',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    minWidth: '180px',
    padding: '8px 0',
    marginLeft: '4px'
  };

  return createPortal(
    <motion.div
      ref={menuRef}
      style={menuStyles}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
    >
      <button
        style={menuItemStyles}
        onClick={handleLoadCanvas}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--theme-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <Edit3 size={16} />
        Open Canvas
      </button>

      <div style={{
        height: '1px',
        background: 'var(--theme-border-secondary)',
        margin: '4px 0'
      }} />

      <button
        style={menuItemStyles}
        onClick={handleRename}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--theme-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <Edit3 size={16} />
        Rename
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--theme-text-secondary)'
        }}>F2</span>
      </button>

      <button
        style={menuItemStyles}
        onClick={handleDuplicate}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--theme-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <Copy size={16} />
        Duplicate
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--theme-text-secondary)'
        }}>⌘D</span>
      </button>

      <div style={{
        height: '1px',
        background: 'var(--theme-border-secondary)',
        margin: '4px 0'
      }} />

      {/* Add to Project submenu */}
      {availableProjectsForAdd.length > 0 && (
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowAddToProject(true)}
          onMouseLeave={() => setShowAddToProject(false)}
        >
          <button style={menuItemStyles}>
            <FolderPlus size={16} />
            Add to Project
            <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
          </button>

          <AnimatePresence>
            {showAddToProject && (
              <motion.div
                style={submenuStyles}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {availableProjectsForAdd.map(project => (
                  <button
                    key={project.id}
                    style={{
                      ...menuItemStyles,
                      padding: '8px 12px'
                    }}
                    onClick={() => handleAddToProject(project.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--theme-bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: project.color,
                      flexShrink: 0
                    }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.name}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Move to Project submenu */}
      {availableProjectsForMove.length > 0 && (
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowMoveToProject(true)}
          onMouseLeave={() => setShowMoveToProject(false)}
        >
          <button style={menuItemStyles}>
            <Move size={16} />
            Move to Project
            <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
          </button>

          <AnimatePresence>
            {showMoveToProject && (
              <motion.div
                style={submenuStyles}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {availableProjectsForMove.map(project => (
                  <button
                    key={project.id}
                    style={{
                      ...menuItemStyles,
                      padding: '8px 12px'
                    }}
                    onClick={() => handleMoveToProject(project.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--theme-bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: project.color,
                      flexShrink: 0
                    }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.name}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Remove from current project */}
      {currentProject && (
        <button
          style={menuItemStyles}
          onClick={handleRemoveFromProject}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--theme-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
        >
          <FolderPlus size={16} style={{ transform: 'rotate(45deg)' }} />
          Remove from "{currentProject.name}"
        </button>
      )}

      <div style={{
        height: '1px',
        background: 'var(--theme-border-secondary)',
        margin: '4px 0'
      }} />

      <button
        style={menuItemStyles}
        onClick={handleDownload}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--theme-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <Download size={16} />
        Download
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--theme-text-secondary)'
        }}>⌘S</span>
      </button>

      <div style={{
        height: '1px',
        background: 'var(--theme-border-secondary)',
        margin: '4px 0'
      }} />

      <button
        style={{
          ...menuItemStyles,
          color: 'var(--theme-error)'
        }}
        onClick={handleDelete}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <Trash2 size={16} />
        Delete
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          opacity: 0.7
        }}>Del</span>
      </button>
    </motion.div>,
    document.body
  );
}
