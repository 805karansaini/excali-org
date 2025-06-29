/**
 * Unified Content Script Entry Point
 * Integrates the file manager panel directly into Excalidraw with full state management
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { initializeDatabase } from '../shared/unified-db';
import { ExcalidrawIntegration } from './excalidraw-integration';
import { ExcalidrawDataBridge } from './bridges/ExcalidrawDataBridge';
import { UnifiedStateProvider } from './context/UnifiedStateProvider';
import { globalEventBus, InternalEventTypes } from './messaging/InternalEventBus';

// Import the enhanced panel application
import { EnhancedAutoHidePanel } from './components/EnhancedAutoHidePanel';

// Global state for the application
let panelRoot: Root | null = null;
let excalidrawIntegration: ExcalidrawIntegration | null = null;
let dataBridge: ExcalidrawDataBridge | null = null;

/**
 * Initialize the unified content script application
 */
async function initializeUnifiedApp(): Promise<void> {
  try {
    console.log('Initializing Excali Organizer Extension...');

    // Emit loading state
    await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, { isLoading: true });

    // 1. Initialize the database
    await initializeDatabase();
    console.log('Database initialized');

    // 2. Wait for Excalidraw to be ready
    await waitForExcalidrawReady();
    console.log('Excalidraw detected');

    // 3. Initialize data bridge
    dataBridge = new ExcalidrawDataBridge({
      autoSave: true,
      syncInterval: 5000,
      debounceDelay: 1000
    });
    dataBridge.initialize();
    console.log('Data bridge initialized');

    // 4. Initialize Excalidraw integration
    excalidrawIntegration = new ExcalidrawIntegration();
    await excalidrawIntegration.initialize();
    console.log('Excalidraw integration initialized');

    // 5. Setup event handlers
    setupEventHandlers();
    console.log('Event handlers setup');

    // 6. Create and mount the panel with state provider
    await createAndMountPanel();
    console.log('Panel mounted successfully');

    // 7. Setup cleanup handlers
    setupCleanupHandlers();
    console.log('Cleanup handlers registered');

    // Emit completion
    await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, { isLoading: false });

    console.log('Excali Organizer extension loaded successfully');

  } catch (error) {
    console.error('Failed to initialize unified app:', error);

    // Emit error state
    await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
      error: 'Initialization failed',
      details: error
    });

    // Attempt recovery or fallback
    await handleInitializationError(error);
  }
}

/**
 * Setup event handlers for the application
 */
function setupEventHandlers(): void {
  // Handle canvas selection events
  globalEventBus.on(InternalEventTypes.CANVAS_SELECTED, async (canvas) => {
    try {
      console.log('Canvas selected:', canvas.name);
      if (dataBridge) {
        await dataBridge.loadCanvasToExcalidraw(canvas);
      }
    } catch (error) {
      console.error('Failed to load canvas:', error);
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: 'Failed to load canvas',
        details: error
      });
    }
  });

  // Handle panel visibility changes
  globalEventBus.on(InternalEventTypes.PANEL_VISIBILITY_CHANGED, ({ isVisible }) => {
    if (excalidrawIntegration) {
      excalidrawIntegration.setPanelVisibility(isVisible);
    }
  });

  // Handle theme changes
  globalEventBus.on(InternalEventTypes.THEME_CHANGED, (theme) => {
    document.documentElement.setAttribute('data-file-manager-theme', theme);
  });

  // Handle Excalidraw data sync
  globalEventBus.on(InternalEventTypes.SYNC_EXCALIDRAW_DATA, async ({ elements }) => {
    try {
      console.log('🔄 Syncing current canvas data to database');
      // We need to determine which canvas is currently active
      // For now, let's save to current working canvas if available
      // This will be implemented when we have proper current canvas tracking
      console.log('Excalidraw data sync:', { elementCount: elements?.length || 0 });
    } catch (error) {
      console.error('Failed to sync Excalidraw data:', error);
    }
  });

  // Handle explicit save requests
  globalEventBus.on(InternalEventTypes.SAVE_EXCALIDRAW_DATA, async ({ canvasId, elements }) => {
    try {
      console.log('💾 Saving canvas data explicitly:', canvasId);
      // This will be handled by the unified state provider
      console.log('Save request:', { canvasId, elementCount: elements?.length || 0 });
    } catch (error) {
      console.error('Failed to save canvas data:', error);
    }
  });

  // Handle error reporting
  globalEventBus.on(InternalEventTypes.ERROR_OCCURRED, ({ error, details }) => {
    console.error('Error reported:', error, details);
    showErrorNotification(error);
  });

  console.log('Event handlers setup complete');
}

/**
 * Wait for Excalidraw to be fully loaded and ready
 */
async function waitForExcalidrawReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30; // 15 seconds max wait
    let attempts = 0;

    const checkExcalidraw = () => {
      attempts++;

      // Check for Excalidraw-specific DOM elements
      const excalidrawContainer = document.querySelector('.App-menu, .App, #root');
      const isExcalidrawUrl = window.location.href.includes('excalidraw.com');

      if (excalidrawContainer && isExcalidrawUrl) {
        resolve();
        return;
      }

      if (attempts >= maxAttempts) {
        reject(new Error('Excalidraw not ready after maximum wait time'));
        return;
      }

      // Check again after 500ms
      setTimeout(checkExcalidraw, 500);
    };

    // Start checking
    checkExcalidraw();
  });
}

/**
 * Create and mount the React panel application
 */
async function createAndMountPanel(): Promise<void> {
  try {
    if (!excalidrawIntegration) {
      throw new Error('Excalidraw integration not initialized');
    }

    // Create panel container in the DOM
    const panelContainer = excalidrawIntegration.createPanelContainer();

    if (!panelContainer) {
      throw new Error('Failed to create panel container');
    }

    // Create React root
    panelRoot = createRoot(panelContainer);

    // Enhanced canvas creation function
    const handleNewCanvas = async () => {
      try {
        console.log('handleNewCanvas called from unified-entry');
        await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, { isLoading: true });

        // This will be handled by the enhanced panel component
        console.log('New canvas creation delegated to enhanced panel');

        await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, { isLoading: false });
      } catch (error) {
        console.error('Error in handleNewCanvas:', error);
      }
    };

    const handleCanvasSelect = async (canvas: any) => {
      try {
        console.log('handleCanvasSelect called from unified-entry:', canvas);
        await globalEventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);
      } catch (error) {
        console.error('Error in handleCanvasSelect:', error);
      }
    };

    // Mount the enhanced panel application with state provider
    const app = React.createElement(
      UnifiedStateProvider,
      {
        children: React.createElement(EnhancedAutoHidePanel, {
          onNewCanvas: handleNewCanvas,
          onCanvasSelect: handleCanvasSelect
        })
      }
    );

    panelRoot.render(app);

  } catch (error) {
    console.error('Failed to create and mount panel:', error);
    throw error;
  }
}

/**
 * Setup cleanup handlers for page navigation and extension unload
 */
function setupCleanupHandlers(): void {
  // Handle page navigation
  const handlePageNavigation = () => {
    console.log('Page navigation detected, cleaning up...');
    cleanup();
  };

  // Listen for navigation events
  window.addEventListener('beforeunload', handlePageNavigation);
  window.addEventListener('pagehide', handlePageNavigation);

  // Handle SPA navigation (for Excalidraw's client-side routing)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handlePageNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handlePageNavigation();
  };

  // Handle extension context invalidation
  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        console.log('Extension context invalidated, cleaning up...');
        cleanup();
      }
    });
  });
}

/**
 * Clean up resources when the extension is unloaded or page navigates
 */
function cleanup(): void {
  try {
    console.log('Starting extension cleanup...');

    // Unmount React application
    if (panelRoot) {
      panelRoot.unmount();
      panelRoot = null;
    }


    // Clean up data bridge
    if (dataBridge) {
      dataBridge.destroy();
      dataBridge = null;
    }

    // Clean up Excalidraw integration
    if (excalidrawIntegration) {
      excalidrawIntegration.cleanup();
      excalidrawIntegration = null;
    }


    // Clear event listeners
    globalEventBus.removeAllListeners();

    console.log('Extension cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Show error notification to the user
 */
function showErrorNotification(message: string): void {
  try {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    `;

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 5000);

  } catch (error) {
    console.error('Failed to show error notification:', error);
  }
}

/**
 * Handle initialization errors with fallback strategies
 */
async function handleInitializationError(error: unknown): Promise<void> {
  console.error('Initialization error details:', error);

  // Try to show a user-friendly error message
  try {
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4757;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    errorContainer.textContent = 'Excali Organizer failed to load. Please refresh the page.';

    document.body.appendChild(errorContainer);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
    }, 5000);

  } catch (fallbackError) {
    console.error('Failed to show error message:', fallbackError);
  }
}

/**
 * Check if we're on a valid Excalidraw page
 */
function isValidExcalidrawPage(): boolean {
  const url = window.location.href;
  return url.includes('excalidraw.com') && !url.includes('excalidraw.com/whiteboard');
}

/**
 * Main entry point - start the application
 */
(async function main() {
  // Check if we're on a valid Excalidraw page
  if (!isValidExcalidrawPage()) {
    console.log('Not on a valid Excalidraw page, skipping extension initialization');
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUnifiedApp);
  } else {
    // DOM is already ready
    await initializeUnifiedApp();
  }
})();

// Export for potential external access (development/debugging)
if (typeof window !== 'undefined') {
  (window as any).__excaliOrganizer = {
    cleanup,
    panelRoot,
    excalidrawIntegration,
    dataBridge,
    eventBus: globalEventBus,
    getStats: () => ({
      isInitialized: panelRoot !== null,
      integration: excalidrawIntegration?.getStats() || null,
      dataBridge: dataBridge?.getStats() || null,
      eventBus: {
        listeners: globalEventBus.eventNames().length,
        events: globalEventBus.eventNames()
      }
    })
  };
}
