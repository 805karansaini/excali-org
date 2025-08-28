/**
 * Unified Content Script Entry Point
 * Integrates the Excali Organizer panel directly into Excalidraw with full state management
 */

import "./styles/theme-variables.css";

// Inject critical CSS inline as fallback
const injectFallbackCSS = () => {
  const style = document.createElement("style");
  style.id = "excali-org-fallback-css";
  style.textContent = `
    /* Fallback theme variables - critical for preventing translucency */
    /* Light theme - only when NOT in dark mode */
    html:not([data-theme="dark"]) {
      --theme-bg-primary: #ffffff !important;
      --theme-bg-secondary: #ffffff !important;
      --theme-bg-tertiary: #f8f9fa !important;
      --theme-bg-hover: #f1f3f4 !important;
      --theme-bg-active: #e8eaed !important;
      --theme-text-primary: #1f2937 !important;
      --theme-text-secondary: #6b7280 !important;
      --theme-border-primary: rgba(0, 0, 0, 0.1) !important;
    }

    /* Dark theme - only when data-theme="dark" */
    html[data-theme="dark"] {
      --theme-bg-primary: #1a1b23 !important;
      --theme-bg-secondary: #232329 !important;
      --theme-bg-tertiary: #2a2b31 !important;
      --theme-bg-hover: #34353b !important;
      --theme-bg-active: #3e3f45 !important;
      --theme-text-primary: #f3f4f6 !important;
      --theme-text-secondary: #d1d5db !important;
      --theme-border-primary: rgba(255, 255, 255, 0.1) !important;
    }
  `;
  document.head.appendChild(style);
};
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  initializeDatabase,
  canvasOperations,
  settingsOperations,
} from "../shared/unified-db";
import { ExcalidrawIntegration } from "./excalidraw-integration";
import { ExcalidrawDataBridge } from "./bridges/ExcalidrawDataBridge";
import { CanvasSwitchOrchestrator } from "./services/CanvasSwitchOrchestrator";
import { UnifiedStateProvider } from "./context/UnifiedStateProvider";
import {
  globalEventBus,
  InternalEventTypes,
} from "./messaging/InternalEventBus";
import { UnifiedCanvas } from "../shared/types";

// Import the enhanced panel application
import { EnhancedAutoHidePanel } from "./components/EnhancedAutoHidePanel";

// Global state for the application
let panelRoot: Root | null = null;
let excalidrawIntegration: ExcalidrawIntegration | null = null;
let dataBridge: ExcalidrawDataBridge | null = null;
let switchOrchestrator: CanvasSwitchOrchestrator | null = null;

/**
 * Initialize the unified content script application
 */
async function initializeUnifiedApp(): Promise<void> {
  try {
    // Inject fallback CSS immediately to prevent any translucency
    injectFallbackCSS();

    // Emit loading state
    await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, {
      isLoading: true,
    });

    // 1. Initialize the database
    await initializeDatabase();

    // 2. Wait for Excalidraw to be ready
    await waitForExcalidrawReady();

    // 3. Initialize data bridge
    dataBridge = new ExcalidrawDataBridge({
      autoSave: true,
      syncInterval: 500,
      debounceDelay: 200,
    });
    dataBridge.initialize();

    // Initialize the orchestrator to coordinate save-before-switch
    switchOrchestrator = new CanvasSwitchOrchestrator(dataBridge);
    switchOrchestrator.initialize();

    // 4. Initialize Excalidraw integration
    excalidrawIntegration = new ExcalidrawIntegration();
    await excalidrawIntegration.initialize();

    // 5. Load initial canvas and update file name
    const currentCanvasId = await settingsOperations.getSetting(
      "currentWorkingCanvasId",
    );
    let currentCanvas: UnifiedCanvas | undefined;
    if (typeof currentCanvasId === "string") {
      currentCanvas = await canvasOperations.getCanvas(currentCanvasId);
    }

    if (currentCanvas) {
      await dataBridge.loadCanvasToExcalidraw(currentCanvas, false);
    } else {
      await dataBridge.updateFileNameOnLoad(null);
    }

    // 6. Setup event handlers
    setupEventHandlers();

    // 7. Create and mount the panel with state provider
    await createAndMountPanel();

    // 8. Setup cleanup handlers
    setupCleanupHandlers();

    // Emit completion
    await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, {
      isLoading: false,
    });
  } catch (error) {
    console.error("Failed to initialize unified app:", error);

    // Emit error state
    await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
      error: "Initialization failed",
      details: error,
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
      if (dataBridge) {
        await dataBridge.loadCanvasToExcalidraw(canvas);
      }
    } catch (error) {
      console.error("Failed to load canvas:", error);
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: "Failed to load canvas",
        details: error,
      });
    }
  });

  // Handle canvas updates (including renames)
  globalEventBus.on(InternalEventTypes.CANVAS_UPDATED, async (canvas) => {
    try {
      // Check if this is the currently active canvas
      const currentCanvasId = await settingsOperations.getSetting("currentWorkingCanvasId");
      
      if (currentCanvasId === canvas.id && dataBridge) {
        // Update file name display for the current canvas
        await dataBridge.updateFileNameDisplay(canvas.name);
      }
    } catch (error) {
      console.error("Failed to handle canvas update:", error);
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: "Failed to update canvas display",
        details: error,
      });
    }
  });

  // Handle panel visibility changes
  globalEventBus.on(
    InternalEventTypes.PANEL_VISIBILITY_CHANGED,
    ({ isVisible }) => {
      if (excalidrawIntegration) {
        excalidrawIntegration.setPanelVisibility(isVisible);
      }
    },
  );

  // Handle theme changes - theme attribute is now set in useThemeSync hook
  globalEventBus.on(InternalEventTypes.THEME_CHANGED, () => {
    // Theme change handled by instant theme sync hook
  });

  globalEventBus.on(
    InternalEventTypes.SYNC_EXCALIDRAW_DATA,
    async () => {
      try {
        // Sync handled by state provider
      } catch (error) {
        console.error("Failed to sync Excalidraw data:", error);
      }
    },
  );

  globalEventBus.on(
    InternalEventTypes.SAVE_EXCALIDRAW_DATA,
    async () => {
      try {
        // Save handled by unified state provider
      } catch (error) {
        console.error("Failed to save canvas data:", error);
      }
    },
  );

  // Handle error reporting
  globalEventBus.on(InternalEventTypes.ERROR_OCCURRED, ({ error, details }) => {
    console.error("Error reported:", error, details);
    showErrorNotification(error);
  });
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
      const excalidrawContainer = document.querySelector(
        ".App-menu, .App, #root",
      );
      const isExcalidrawUrl = window.location.href.includes("excalidraw.com");

      if (excalidrawContainer && isExcalidrawUrl) {
        resolve();
        return;
      }

      if (attempts >= maxAttempts) {
        reject(new Error("Excalidraw not ready after maximum wait time"));
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
      throw new Error("Excalidraw integration not initialized");
    }

    // Create panel container in the DOM
    const panelContainer = excalidrawIntegration.createPanelContainer();

    if (!panelContainer) {
      throw new Error("Failed to create panel container");
    }

    // Create React root
    panelRoot = createRoot(panelContainer);

    // Enhanced canvas creation function
    const handleNewCanvas = async () => {
      try {
        await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, {
          isLoading: true,
        });

        // This will be handled by the enhanced panel component

        await globalEventBus.emit(InternalEventTypes.LOADING_STATE_CHANGED, {
          isLoading: false,
        });
      } catch (error) {
        console.error("Error in handleNewCanvas:", error);
      }
    };

    const handleCanvasSelect = async (canvas: UnifiedCanvas) => {
      try {
        await globalEventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);
      } catch (error) {
        console.error("Error in handleCanvasSelect:", error);
      }
    };

    // Mount the enhanced panel application with state provider
    const app = React.createElement(
      UnifiedStateProvider,

      {
        children: React.createElement(EnhancedAutoHidePanel, {
          onNewCanvas: handleNewCanvas,
          onCanvasSelect: handleCanvasSelect,
        }),
      },
    );

    panelRoot.render(app);
  } catch (error) {
    console.error("Failed to create and mount panel:", error);
    throw error;
  }
}

/**
 * Setup cleanup handlers for page navigation and extension unload
 */
function setupCleanupHandlers(): void {
  // Handle page navigation
  const handlePageNavigation = () => {
    cleanup();
  };

  // Listen for navigation events
  window.addEventListener("beforeunload", handlePageNavigation);
  window.addEventListener("pagehide", handlePageNavigation);

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
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

/**
 * Show error notification to the user
 */
function showErrorNotification(message: string): void {
  try {
    const notification = document.createElement("div");
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
    const style = document.createElement("style");
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
        notification.style.animation = "slideIn 0.3s ease-out reverse";
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
    console.error("Failed to show error notification:", error);
  }
}

/**
 * Handle initialization errors with fallback strategies
 */
async function handleInitializationError(error: unknown): Promise<void> {
  console.error("Initialization error details:", error);

  // Try to show a user-friendly error message
  try {
    const errorContainer = document.createElement("div");
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
    errorContainer.textContent =
      "Excali Organizer failed to load. Please refresh the page.";

    document.body.appendChild(errorContainer);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
    }, 5000);
  } catch (fallbackError) {
    console.error("Failed to show error message:", fallbackError);
  }
}

/**
 * Check if we're on a valid Excalidraw page
 */
function isValidExcalidrawPage(): boolean {
  const url = window.location.href;
  return (
    url.includes("excalidraw.com") && !url.includes("excalidraw.com/whiteboard")
  );
}

/**
 * Main entry point - start the application
 */
(async function main() {
  // Check if we're on a valid Excalidraw page
  if (!isValidExcalidrawPage()) {
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeUnifiedApp);
  } else {
    // DOM is already ready
    await initializeUnifiedApp();
  }
})();

// Export for potential external access (development/debugging)
if (typeof window !== "undefined") {
  (
    window as Window & typeof globalThis & { __excaliOrganizer: unknown }
  ).__excaliOrganizer = {
    cleanup,
    panelRoot,
    excalidrawIntegration,
    dataBridge,
    switchOrchestrator,
    eventBus: globalEventBus,
    getStats: () => ({
      isInitialized: panelRoot !== null,
      integration: excalidrawIntegration?.getStats() || null,
      dataBridge: dataBridge?.getStats() || null,
      eventBus: {
        listeners: globalEventBus.eventNames().length,
        events: globalEventBus.eventNames(),
      },
    }),
  };
}
