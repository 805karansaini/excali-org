// TODO: Phase 1.5 - Basic Panel Container Implementation
// This component serves as the main React application for the embedded panel

import React, { useState, useEffect } from 'react';
import { UnifiedCanvas, UnifiedProject } from '../../shared/types';
import { canvasOperations, projectOperations } from '../../shared/unified-db';

// Basic styles for the panel
const panelStyles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'rgba(35, 35, 41, 0.95)',
    color: 'rgba(222, 222, 227)',
    fontFamily: 'Roboto, Arial, sans-serif',
    overflow: 'hidden'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(35, 35, 41, 0.98)'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 500,
    color: 'rgba(222, 222, 227)'
  },
  content: {
    flex: 1,
    padding: '16px',
    overflow: 'auto'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'rgba(222, 222, 227, 0.8)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  item: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid transparent'
  },
  itemHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  itemName: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px'
  },
  itemMeta: {
    fontSize: '12px',
    color: 'rgba(222, 222, 227, 0.6)'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  buttonHover: {
    backgroundColor: 'rgba(76, 175, 80, 1)'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '24px',
    color: 'rgba(222, 222, 227, 0.6)'
  }
};

interface UnifiedPanelAppProps {
  onCanvasSelect?: (canvas: UnifiedCanvas) => void;
  onNewCanvas?: () => void;
}

export const UnifiedPanelApp: React.FC<UnifiedPanelAppProps> = ({
  onCanvasSelect,
  onNewCanvas
}) => {
  const [canvases, setCanvases] = useState<UnifiedCanvas[]>([]);
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load canvases and projects from IndexedDB
      const [loadedCanvases, loadedProjects] = await Promise.all([
        canvasOperations.getAllCanvases(),
        projectOperations.getAllProjects()
      ]);

      setCanvases(loadedCanvases);
      setProjects(loadedProjects);

    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load file manager data');
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasClick = (canvas: UnifiedCanvas) => {
    if (onCanvasSelect) {
      onCanvasSelect(canvas);
    }
    
    // Also update Excalidraw with the canvas data
    try {
      const excalidrawData = {
        elements: canvas.elements || [],
        appState: canvas.appState || {}
      };
      
      localStorage.setItem('excalidraw', JSON.stringify(excalidrawData));
      
      // Trigger page reload to load the data
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to load canvas:', error);
    }
  };

  const handleNewCanvas = () => {
    if (onNewCanvas) {
      onNewCanvas();
    } else {
      // Create a new canvas
      createNewCanvas();
    }
  };

  const createNewCanvas = async () => {
    try {
      const now = new Date();
      const newCanvas: UnifiedCanvas = {
        id: `canvas-${Date.now()}`,
        name: `New Canvas ${canvases.length + 1}`,
        createdAt: now,
        updatedAt: now,
        lastModified: now.toISOString(),
        elements: [],
        excalidraw: []
      };

      await canvasOperations.addCanvas(newCanvas);
      await loadData(); // Refresh the list

      // Load the new canvas in Excalidraw
      handleCanvasClick(newCanvas);

    } catch (error) {
      console.error('Failed to create new canvas:', error);
      setError('Failed to create new canvas');
    }
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

  const getUnorganizedCanvases = () => {
    return canvases.filter(canvas => !canvas.projectId);
  };

  if (loading) {
    return (
      <div style={panelStyles.container}>
        <div style={panelStyles.header}>
          <h2 style={panelStyles.title}>File Manager</h2>
        </div>
        <div style={panelStyles.content}>
          <div style={panelStyles.emptyState}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={panelStyles.container}>
        <div style={panelStyles.header}>
          <h2 style={panelStyles.title}>File Manager</h2>
        </div>
        <div style={panelStyles.content}>
          <div style={panelStyles.emptyState}>
            <div style={{ color: '#ff4757', marginBottom: '12px' }}>⚠️ Error</div>
            <div>{error}</div>
            <button 
              style={{ ...panelStyles.button, marginTop: '12px' }}
              onClick={loadData}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyles.container}>
      {/* Header */}
      <div style={panelStyles.header}>
        <h2 style={panelStyles.title}>Excalidraw File Manager</h2>
        <button
          style={{
            ...panelStyles.button,
            marginTop: '12px',
            ...(hoveredItem === 'new-button' ? panelStyles.buttonHover : {})
          }}
          onClick={handleNewCanvas}
          onMouseEnter={() => setHoveredItem('new-button')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          ➕ New Canvas
        </button>
      </div>

      {/* Content */}
      <div style={panelStyles.content}>
        {/* Projects Section */}
        {projects.length > 0 && (
          <div style={panelStyles.section}>
            <div style={panelStyles.sectionTitle}>Projects</div>
            {projects.map(project => {
              const projectCanvases = canvases.filter(c => c.projectId === project.id);
              
              return (
                <div key={project.id} style={panelStyles.item}>
                  <div style={panelStyles.itemName}>
                    📁 {project.name}
                  </div>
                  <div style={panelStyles.itemMeta}>
                    {projectCanvases.length} canvas{projectCanvases.length !== 1 ? 'es' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Canvases Section */}
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionTitle}>Recent Canvases</div>
          
          {getUnorganizedCanvases().length > 0 ? (
            getUnorganizedCanvases()
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
              .slice(0, 10) // Show only recent 10
              .map(canvas => (
                <div
                  key={canvas.id}
                  style={{
                    ...panelStyles.item,
                    ...(hoveredItem === canvas.id ? panelStyles.itemHover : {})
                  }}
                  onClick={() => handleCanvasClick(canvas)}
                  onMouseEnter={() => setHoveredItem(canvas.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div style={panelStyles.itemName}>
                    📄 {canvas.name}
                  </div>
                  <div style={panelStyles.itemMeta}>
                    Updated {formatDate(canvas.updatedAt)}
                  </div>
                </div>
              ))
          ) : (
            <div style={panelStyles.emptyState}>
              <div style={{ marginBottom: '12px' }}>📄</div>
              <div style={{ marginBottom: '8px' }}>No canvases yet</div>
              <div style={{ fontSize: '12px' }}>
                Create your first canvas to get started
              </div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionTitle}>Statistics</div>
          <div style={{ ...panelStyles.item, cursor: 'default' }}>
            <div style={panelStyles.itemMeta}>
              📊 {canvases.length} total canvas{canvases.length !== 1 ? 'es' : ''}, {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};