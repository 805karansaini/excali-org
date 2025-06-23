/// <reference types="chrome"/>

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { initializeDatabase } from '../shared/unified-db';
import { ExcalidrawIntegration } from './excalidraw-integration';

// Import the panel application
import { UnifiedPanelApp } from './components/UnifiedPanelApp';

// Global state for the application
let panelRoot: Root | null = null;
let excalidrawIntegration: ExcalidrawIntegration | null = null;

/**
 * Initialize the unified content script application
 */
async function initializeUnifiedApp(): Promise<void> {
  try {
    console.log('Initializing Excalidraw File Manager Unified Extension...');

    // 1. Initialize the database
    await initializeDatabase();
    console.log('Database initialized');

    // 2. Wait for Excalidraw to be ready
    await waitForExcalidrawReady();
    console.log('Excalidraw detected');

    // 3. Initialize Excalidraw integration
    excalidrawIntegration = new ExcalidrawIntegration();
    await excalidrawIntegration.initialize();
    console.log('Excalidraw integration initialized');

    // 4. Create and mount the panel
    await createAndMountPanel();
    console.log('Panel mounted successfully');

    // 5. Setup cleanup handlers
    setupCleanupHandlers();
    console.log('Cleanup handlers registered');

    console.log('✅ Excalidraw File Manager extension loaded successfully');

  } catch (error) {
    console.error('Failed to initialize unified app:', error);

    // Attempt recovery or fallback
    await handleInitializationError(error);
  }
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

    // Mount the unified panel application
    const panelApp = React.createElement(UnifiedPanelApp, {
      onCanvasSelect: (canvas) => {
        console.log('Canvas selected:', canvas.name);
        if (excalidrawIntegration) {
          excalidrawIntegration.updateFileNameDisplay(canvas.name);
        }
      },
      onNewCanvas: () => {
        console.log('New canvas requested');
        if (excalidrawIntegration) {
          excalidrawIntegration.updateFileNameDisplay('New Canvas');
        }
      }
    });

    panelRoot.render(panelApp);

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
    // Unmount React application
    if (panelRoot) {
      panelRoot.unmount();
      panelRoot = null;
    }

    // Clean up Excalidraw integration
    if (excalidrawIntegration) {
      excalidrawIntegration.cleanup();
      excalidrawIntegration = null;
    }

    console.log('Extension cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
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
    errorContainer.textContent = 'Excalidraw File Manager failed to load. Please refresh the page.';

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
  (window as any).__excalidrawFileManager = {
    cleanup,
    panelRoot,
    excalidrawIntegration
  };
}
