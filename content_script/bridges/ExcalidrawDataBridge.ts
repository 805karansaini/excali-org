/**
 * ExcalidrawDataBridge - Handles synchronization between Excali Organizer and Excalidraw
 * Manages canvas loading, saving, and real-time sync with Excalidraw's localStorage
 */

import { UnifiedCanvas } from "../../shared/types";
import {
  globalEventBus,
  InternalEventTypes,
} from "../messaging/InternalEventBus";

import {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "../../shared/excalidraw-types";
import { v4 as uuidv4 } from "uuid";

export interface ExcalidrawData {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files?: BinaryFiles;
}

export interface ExcalidrawSyncOptions {
  autoSave: boolean;
  syncInterval: number; // milliseconds
  debounceDelay: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
}

interface PendingOperation {
  operationId: string;
  canvasId: string;
  operationType: 'auto-save' | 'manual-save' | 'load' | 'retry';
  timestamp: number;
  debounceTimeout?: number;
  retryCount?: number;
  parentOperationId?: string; // Link retries to original operations
}

/**
 * Bridge class for Excalidraw integration
 */
export class ExcalidrawDataBridge {
  private syncInterval: number | null = null;
  private lastSyncData: string | null = null;
  private debounceTimeout: number | null = null;
  private isLoading: boolean = false;
  private options: ExcalidrawSyncOptions;
  private retryCount: number = 0;
  private lastSyncTimestamp: number = 0;
  private storageEventQueue: StorageEvent[] = [];
  private processingQueue: boolean = false;
  private syncInProgress: boolean = false;

  // Canvas operation coordination
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private operationIdMap: Map<string, string> = new Map(); // operationId -> canvasKey for O(1) lookup
  private currentCanvasContext: string | null = null;
  private themeUnsubscribe: (() => void) | null = null;

  constructor(options: Partial<ExcalidrawSyncOptions> = {}) {
    this.options = {
      autoSave: true,
      syncInterval: 1000, // Reduced to 1 second for faster detection
      debounceDelay: 350, // Aligned with Excalidraw's 300ms + buffer
      maxRetries: 3,
      retryDelay: 500,
      ...options,
    };

    this.setupEventListeners();
  }

  /**
   * Initialize the bridge and start monitoring
   */
  initialize(): void {
    console.log("[ExcalidrawDataBridge] Initializing bridge...");

    // Initialize last sync data with current Excalidraw data if it exists
    try {
      const currentData = this.getExcalidrawData();
      if (currentData) {
        this.lastSyncData = JSON.stringify(currentData);
        console.log(
          "[ExcalidrawDataBridge] Initialized with existing Excalidraw data",
        );
      } else {
        console.log("[ExcalidrawDataBridge] No existing Excalidraw data found");
      }
    } catch (error) {
      console.warn(
        "[ExcalidrawDataBridge] Failed to initialize with existing data:",
        error,
      );
    }

    if (this.options.autoSave) {
      this.startAutoSync();
    }

    // Listen for Excalidraw data changes
    this.setupStorageListener();

    // Listen for theme changes to update filename display
    this.setupThemeListener();
  }

  /**
   * Enhanced cleanup with queue clearing
   */
  destroy(): void {
    console.log("[ExcalidrawDataBridge] Destroying bridge...");

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    // Cancel all pending operations
    this.cancelAllPendingOperations();

    // Clear queue and reset state
    this.resetSyncState();

    // Remove event listeners
    window.removeEventListener("storage", this.handleStorageChange);

    // Unsubscribe from theme changes
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
  }

  /**
   * Cancel all pending operations with enhanced logging
   */
  private cancelAllPendingOperations(): void {
    console.log(`[ExcalidrawDataBridge] Cancelling all pending operations (${this.pendingOperations.size} operations)`);

    for (const [, operation] of this.pendingOperations) {
      if (operation.debounceTimeout) {
        clearTimeout(operation.debounceTimeout);
      }
      console.log(`[Operation ${operation.operationId}] Cancelled ${operation.operationType} for canvas ${operation.canvasId}`);
    }

    this.pendingOperations.clear();
    this.operationIdMap.clear();
  }

  /**
   * Cancel operations for a specific canvas
   */
  private cancelCanvasOperations(canvasId: string): void {
    const operation = this.pendingOperations.get(canvasId);
    if (operation) {
      if (operation.debounceTimeout) {
        clearTimeout(operation.debounceTimeout);
      }
      this.pendingOperations.delete(canvasId);
      this.operationIdMap.delete(operation.operationId);
      console.log(`[Operation ${operation.operationId}] Cancelled ${operation.operationType} for canvas ${canvasId}`);
    }
  }

  /**
   * Validate if an operation is still valid for execution (O(1) optimized)
   */
  private isOperationValid(operationId: string, canvasId: string): boolean {
    // Check if canvas context has changed
    if (this.currentCanvasContext !== canvasId) {
      console.log(`[Operation ${operationId}] Invalid: canvas context changed (expected: ${canvasId}, current: ${this.currentCanvasContext})`);
      return false;
    }

    // Check if loading is in progress
    if (this.isLoading) {
      console.log(`[Operation ${operationId}] Invalid: canvas loading in progress`);
      return false;
    }

    // O(1) operation lookup using operationIdMap
    const canvasKey = this.operationIdMap.get(operationId);
    if (canvasKey) {
      const operation = this.pendingOperations.get(canvasKey);
      if (operation) {
        const age = Date.now() - operation.timestamp;
        if (age > 10000) { // 10 seconds
          console.log(`[Operation ${operationId}] Invalid: operation is stale (age: ${age}ms)`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Set canvas context for operation coordination
   */
  private setCanvasContext(canvasId: string): void {
    if (this.currentCanvasContext !== canvasId) {
      console.log(`[ExcalidrawDataBridge] Canvas context changed: ${this.currentCanvasContext} -> ${canvasId}`);
      this.currentCanvasContext = canvasId;
    }
  }

  /**
   * Load a canvas into Excalidraw with atomic operation coordination
   */
  async loadCanvasToExcalidraw(
    canvas: UnifiedCanvas,
    forceReload: boolean = false,
  ): Promise<void> {
    const operationId = `load_${canvas.id}_${uuidv4()}`;

    try {
      console.log(
        `[ExcalidrawDataBridge] Starting atomic canvas load: ${canvas.name} (forceReload: ${forceReload}) [${operationId}]`,
      );

      // STEP 1: Cancel ALL pending operations for ALL canvases to prevent race conditions
      this.cancelAllPendingOperations();

      // STEP 2: Set loading state and canvas context
      this.isLoading = true;
      this.setCanvasContext(canvas.id);

      // STEP 3: Register this load operation
      this.pendingOperations.set(canvas.id, {
        operationId,
        canvasId: canvas.id,
        operationType: 'load',
        timestamp: Date.now()
      });

      // Maintain O(1) lookup map
      this.operationIdMap.set(operationId, canvas.id);

      // Prepare Excalidraw data with proper element structure
      let elements = canvas.elements || [];

      // Ensure all elements have required properties for Excalidraw
      elements = elements.map((element, index) => ({
        // Preserve existing properties first
        ...element,

        // Override with defaults only if not present
        id: element.id || `element_${Date.now()}_${index}`,
        type: element.type || "rectangle",
        x: element.x ?? 0,
        y: element.y ?? 0,
        width: element.width ?? 100,
        height: element.height ?? 100,
        angle: element.angle ?? 0,
        strokeColor: element.strokeColor || "#000000",
        backgroundColor: element.backgroundColor || "transparent",
        fillStyle: element.fillStyle || "hachure",
        strokeWidth: element.strokeWidth ?? 1,
        strokeStyle: element.strokeStyle || "solid",
        roughness: element.roughness ?? 1,
        opacity: element.opacity ?? 100,
        groupIds: element.groupIds || [],
        frameId: element.frameId ?? null,
        roundness: element.roundness ?? null,
        boundElements: element.boundElements ?? null,
        link: element.link ?? null,
        seed: element.seed ?? Math.floor(Math.random() * 2147483647),
        versionNonce:
          element.versionNonce ?? Math.floor(Math.random() * 2147483647),
        isDeleted: element.isDeleted ?? false,
        updated: element.updated ?? 1,
        locked: element.locked ?? false,
      }));

      // Preserve current Excalidraw theme to prevent flicker during canvas loading
      const getCurrentTheme = (): "light" | "dark" => {
        try {
          // Check current excalidraw-state first
          const excalidrawState = localStorage.getItem("excalidraw-state");
          if (excalidrawState) {
            const state = JSON.parse(excalidrawState);
            if (state.theme === "dark" || state.theme === "light") {
              return state.theme;
            }
          }

          // Check document data-theme attribute
          const documentTheme = document.documentElement.getAttribute("data-theme");
          if (documentTheme === "dark" || documentTheme === "light") {
            return documentTheme;
          }

          // Fallback to system preference
          return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        } catch {
          return "light";
        }
      };

      const excalidrawData: ExcalidrawData = {
        elements: elements,
        appState: canvas.appState || {
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
          width: window.innerWidth,
          height: window.innerHeight,
          viewBackgroundColor: "#ffffff",
          theme: getCurrentTheme(), // Use current theme instead of hardcoded "light"
          selectedElementIds: {},
          editingGroupId: null,
          viewModeEnabled: false,
        },
        files: {}, // Files are handled separately in Excalidraw
      };

      // STEP 4: Perform atomic localStorage update
      console.log(`[ExcalidrawDataBridge] Writing canvas data to localStorage [${operationId}]`);
      this.setExcalidrawData(excalidrawData);

      // STEP 5: Update bridge state to reflect the new canvas
      this.lastSyncData = JSON.stringify(excalidrawData);
      console.log(`[ExcalidrawDataBridge] Updated lastSyncData for canvas ${canvas.id} [${operationId}]`);

      // STEP 6: Emit events (canvas loading complete)
      await globalEventBus.emit(InternalEventTypes.CANVAS_LOADED, canvas);

      // STEP 7: Update file name display
      await this.updateFileNameDisplay(canvas.name);

      // STEP 8: Mark operation as complete
      this.pendingOperations.delete(canvas.id);
      this.operationIdMap.delete(operationId);
      console.log(`[ExcalidrawDataBridge] Canvas load operation completed [${operationId}]`);

      // Reload if forced
      if (forceReload) {
        console.log(
          "[ExcalidrawDataBridge] Canvas data prepared, reloading page to load canvas:",
          canvas.name,
        );
        // Give a small delay to ensure localStorage is written before reload
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch (error) {
      console.error(`[ExcalidrawDataBridge] Failed to load canvas [${operationId}]:`, error);

      // Clean up failed operation
      this.pendingOperations.delete(canvas.id);
      this.operationIdMap.delete(operationId);

      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: "Failed to load canvas into Excalidraw",
        details: error,
      });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Update file name on initial load
   */
  async updateFileNameOnLoad(canvasName: string | null): Promise<void> {
    const name = canvasName || "Please choose a file to start drawing";
    await this.updateFileNameDisplay(name);
  }

  /**
   * Save current Excalidraw data to a canvas
   */
  async saveExcalidrawData(canvasId: string): Promise<ExcalidrawData | null> {
    try {
      const excalidrawData = this.getExcalidrawData();
      if (!excalidrawData) {
        console.warn("[ExcalidrawDataBridge] No Excalidraw data found to save");
        return null;
      }

      // Emit save event
      await globalEventBus.emit(InternalEventTypes.SAVE_EXCALIDRAW_DATA, {
        canvasId,
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
      });

      return excalidrawData;
    } catch (error) {
      console.error(
        "[ExcalidrawDataBridge] Failed to save Excalidraw data:",
        error,
      );
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: "Failed to save Excalidraw data",
        details: error,
      });
      return null;
    }
  }

  /**
   * Get current Excalidraw data from localStorage
   */
  getExcalidrawData(): ExcalidrawData | null {
    try {
      // Get elements from the main excalidraw key (which is just an array)
      const elementsData = localStorage.getItem("excalidraw");
      let elements = [];

      if (elementsData) {
        try {
          const parsed = JSON.parse(elementsData);
          if (Array.isArray(parsed)) {
            elements = parsed;
            console.log(
              "[ExcalidrawDataBridge] Found",
              elements.length,
              "elements in localStorage",
            );
          } else {
            console.warn(
              "[ExcalidrawDataBridge] Excalidraw data is not an array:",
              typeof parsed,
            );
          }
        } catch (parseError) {
          console.warn(
            "[ExcalidrawDataBridge] Failed to parse excalidraw elements data:",
            parseError,
          );
        }
      }

      // Get appState from excalidraw-state key
      let appState: AppState = {
        zoom: { value: 1 },
        scrollX: 0,
        scrollY: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        viewBackgroundColor: "#ffffff",
        theme: "light" as const,
        selectedElementIds: {},
        editingGroupId: null,
        viewModeEnabled: false,
      };
      const stateData = localStorage.getItem("excalidraw-state");
      if (stateData) {
        try {
          const parsedState = JSON.parse(stateData);
          appState = { ...appState, ...parsedState };
          console.log(
            "[ExcalidrawDataBridge] Found appState in excalidraw-state",
          );
        } catch (parseError) {
          console.warn(
            "[ExcalidrawDataBridge] Failed to parse excalidraw-state:",
            parseError,
          );
        }
      }

      // Only return data if we have elements or meaningful appState
      if (elements.length > 0 || Object.keys(appState).length > 0) {
        return {
          elements: elements,
          appState: appState,
          files: {}, // Files are typically stored elsewhere
        };
      }

      console.log("[ExcalidrawDataBridge] No valid Excalidraw data found");
      return null;
    } catch (error) {
      console.error(
        "[ExcalidrawDataBridge] Failed to get Excalidraw data:",
        error,
      );
      return null;
    }
  }

  /**
   * Set Excalidraw data to localStorage
   */
  private setExcalidrawData(data: ExcalidrawData): void {
    try {
      console.log(
        "[ExcalidrawDataBridge] Setting Excalidraw data with",
        data.elements?.length || 0,
        "elements",
      );

      // CRITICAL FIX: Excalidraw expects just an array of elements, not an object
      const elementsArray = data.elements || [];

      // Set the main localStorage key with just the elements array
      localStorage.setItem("excalidraw", JSON.stringify(elementsArray));

      // Store appState separately if it exists (Excalidraw uses excalidraw-state for this)
      if (data.appState && Object.keys(data.appState).length > 0) {
        // Get existing state and merge with our appState
        let existingState: Record<string, unknown> = {};
        try {
          const existing = localStorage.getItem("excalidraw-state");
          if (existing) {
            existingState = JSON.parse(existing);
          }
        } catch {
          console.warn(
            "[ExcalidrawDataBridge] Failed to parse existing state:",
          );
        }

        // Exclude theme from canvas appState to preserve current Excalidraw theme
        const { theme: _theme, ...appStateWithoutTheme } = data.appState;

        const mergedState = {
          ...existingState,
          ...appStateWithoutTheme, // Merge everything except theme
          // Preserve existing theme (don't overwrite with canvas data)
          theme: (existingState.theme as string) || _theme || "light"
        };

        localStorage.setItem("excalidraw-state", JSON.stringify(mergedState));
        console.log(
          "[ExcalidrawDataBridge] Updated excalidraw-state with appState",
        );
      }

      console.log(
        "[ExcalidrawDataBridge] Successfully set Excalidraw data (elements array format) with",
        elementsArray.length,
        "elements",
      );
    } catch (error) {
      console.error(
        "[ExcalidrawDataBridge] Failed to set Excalidraw data:",
        error,
      );
      throw error;
    }
  }

  /**
   * Update the file name display on the Excalidraw page
   */
  async updateFileNameDisplay(fileName: string): Promise<void> {
    try {
      // Remove existing file name display
      const existingDisplay = document.querySelector(".file-name-div");
      if (existingDisplay) {
        existingDisplay.remove();
      }

      // Create new file name display
      const fileNameDiv = document.createElement("div");
      fileNameDiv.classList.add("file-name-div");
      fileNameDiv.textContent = fileName;

      const isDarkTheme = document.documentElement.getAttribute("data-theme") === "dark";

      const baseStyle = `
        position: absolute;
        top: 5px;
        left: 48px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 500;
        z-index: 1000;
        pointer-events: none;
        backdrop-filter: blur(4px);
        transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
      `;

      fileNameDiv.style.cssText = isDarkTheme
        ? `
        ${baseStyle}
        background-color: rgba(35, 35, 41, 0.9);
        color: rgba(222, 222, 227, 1);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `
        : `
        ${baseStyle}
        background-color: rgba(248, 249, 250, 0.95);
        color: rgba(55, 65, 81, 1);
        border: 1px solid rgba(0, 0, 0, 0.1);
      `;

      // Find Excalidraw container and append
      const excalidrawContainer =
        document.querySelector(".App-menu") ||
        document.querySelector(".App") ||
        document.body;
      if (excalidrawContainer) {
        excalidrawContainer.appendChild(fileNameDiv);
      }

      // Emit event
      await globalEventBus.emit(InternalEventTypes.UPDATE_FILE_NAME_DISPLAY, {
        fileName,
      });
    } catch (error) {
      console.error(
        "[ExcalidrawDataBridge] Failed to update file name display:",
        error,
      );
    }
  }

  /**
   * Check if current data has changed with enhanced detection
   */
  private hasDataChanged(): boolean {
    try {
      const currentData = this.getExcalidrawData();
      if (!currentData) {
        console.log(
          "[ExcalidrawDataBridge] No current data found for change detection",
        );
        return false;
      }

      // If we have no previous data, consider it changed
      if (!this.lastSyncData) {
        console.log(
          "[ExcalidrawDataBridge] No previous sync data, considering as changed",
        );
        return true;
      }

      // Quick comparison first - if same, no changes
      const currentDataStr = JSON.stringify(currentData);
      if (currentDataStr === this.lastSyncData) {
        return false;
      }

      return this.hasDeepChanges(currentData);
    } catch (error) {
      console.error(
        "[ExcalidrawDataBridge] Error checking data changes:",
        error,
      );
      return true; // Assume changes to be safe
    }
  }

  /**
   * Deep change detection for text elements and properties
   */
  private hasDeepChanges(currentData: ExcalidrawData): boolean {
    try {
      let lastData: ExcalidrawData;
      try {
        lastData = JSON.parse(this.lastSyncData!);
      } catch {
        return true; // Parse error, assume changes
      }

      const currentElements = currentData.elements || [];
      const lastElements = lastData.elements || [];

      // Check element count first
      if (currentElements.length !== lastElements.length) {
        console.log(
          "[ExcalidrawDataBridge] Element count changed:",
          lastElements.length,
          "->",
          currentElements.length,
        );
        return true;
      }

      // Create maps for efficient comparison
      const currentElementsMap = new Map(currentElements.map(el => [el.id, el]));
      const lastElementsMap = new Map(lastElements.map(el => [el.id, el]));

      // Check for new or removed elements
      for (const id of currentElementsMap.keys()) {
        if (!lastElementsMap.has(id)) {
          console.log("[ExcalidrawDataBridge] New element detected:", id);
          return true;
        }
      }

      for (const id of lastElementsMap.keys()) {
        if (!currentElementsMap.has(id)) {
          console.log("[ExcalidrawDataBridge] Element removed:", id);
          return true;
        }
      }

      // Deep comparison of element properties
      for (const [id, currentElement] of currentElementsMap) {
        const lastElement = lastElementsMap.get(id)!;

        // Check critical properties that indicate content changes
        const criticalProps = [
          'text', 'rawText', 'originalText', // Text content
          'x', 'y', 'width', 'height', // Position/size
          'angle', 'strokeColor', 'backgroundColor', // Styling
          'versionNonce', 'updated' // Version tracking
        ];

        for (const prop of criticalProps) {
          const currentValue = (currentElement as Record<string, unknown>)[prop];
          const lastValue = (lastElement as Record<string, unknown>)[prop];
          if (currentValue !== lastValue) {
            // Development logging removed for production build
            return true;
          }
        }
      }

      // Check app state changes
      const appStateChanged = this.hasAppStateChanged(currentData.appState, lastData.appState);
      if (appStateChanged) {
        console.log("[ExcalidrawDataBridge] App state changed");
        return true;
      }

      return false;
    } catch (error) {
      console.error("[ExcalidrawDataBridge] Error in deep change detection:", error);
      return true; // Assume changes to be safe
    }
  }


  /**
   * Check if app state has meaningful changes
   */
  private hasAppStateChanged(currentAppState: AppState, lastAppState: AppState): boolean {
    // Ignore transient properties that don't affect the saved state
    const ignoreProps = ['selectedElementIds', 'editingGroupId', 'scrollX', 'scrollY', 'zoom'];

    const currentFiltered = { ...currentAppState };
    const lastFiltered = { ...lastAppState };

    for (const prop of ignoreProps) {
      delete (currentFiltered as Record<string, unknown>)[prop];
      delete (lastFiltered as Record<string, unknown>)[prop];
    }

    return JSON.stringify(currentFiltered) !== JSON.stringify(lastFiltered);
  }

  /**
   * Start automatic sync monitoring
   */
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (!this.isLoading && this.hasDataChanged()) {
        this.debouncedSync();
      }
    }, this.options.syncInterval);

    console.log("[ExcalidrawDataBridge] Auto-sync started");
  }

  /**
   * Enhanced debounced sync with retry logic
   */
  /**
   * Canvas-aware debounced sync that prevents race conditions
   */
  private debouncedSync(): void {
    // Only sync if we have a valid canvas context and not loading
    if (!this.currentCanvasContext || this.isLoading) {
      console.log("[ExcalidrawDataBridge] Skipping sync - no canvas context or loading in progress");
      return;
    }

    this.debouncedSyncForCanvas(this.currentCanvasContext);
  }

  /**
   * Canvas-specific debounced sync
   */
  private debouncedSyncForCanvas(canvasId: string): void {
    // Cancel any existing operations for this canvas
    this.cancelCanvasOperations(canvasId);

    // Generate unique operation ID
    const operationId = `auto-save_${canvasId}_${uuidv4()}`;
    console.log(`[ExcalidrawDataBridge] Scheduling auto-save for canvas ${canvasId} [${operationId}]`);

    const timeout = setTimeout(async () => {
      try {
        await this.performSyncForCanvas(canvasId, operationId);
      } catch (error) {
        console.error(`[Operation ${operationId}] Auto-save failed:`, error);
      } finally {
        // Always cleanup, regardless of success/failure
        this.pendingOperations.delete(canvasId);
        this.operationIdMap.delete(operationId);
        console.log(`[Operation ${operationId}] Cleaned up operation`);
      }
    }, this.options.debounceDelay);

    this.pendingOperations.set(canvasId, {
      operationId,
      canvasId,
      operationType: 'auto-save',
      timestamp: Date.now(),
      debounceTimeout: timeout
    });

    // Maintain O(1) lookup map
    this.operationIdMap.set(operationId, canvasId);
  }

  /**
   * Canvas-aware sync that prevents cross-canvas data corruption
   */
  private async performSyncForCanvas(canvasId: string, operationId?: string): Promise<void> {
    // Atomic check-and-set to prevent race condition
    if (this.syncInProgress) {
      console.log("[ExcalidrawDataBridge] Sync already in progress, skipping");
      return;
    }

    // Immediately set sync in progress to prevent concurrent execution
    this.syncInProgress = true;

    try {
      // Validate operation is still valid for execution
      const currentOperationId = operationId || `legacy_sync_${canvasId}_${Date.now()}`;
      if (!this.isOperationValid(currentOperationId, canvasId)) {
        console.log(`[Operation ${currentOperationId}] Operation validation failed, aborting sync`);
        return;
      }

      const startTime = Date.now();
      const currentData = this.getExcalidrawData();
      if (!currentData) {
        console.log(`[Operation ${currentOperationId}] No data to sync for canvas ${canvasId}`);
        return;
      }

      // Validate data integrity
      if (!this.validateDataIntegrity(currentData)) {
        console.warn(`[Operation ${currentOperationId}] Data integrity check failed for canvas ${canvasId}, skipping sync`);
        return;
      }

      // Final validation: re-check operation validity just before execution
      if (!this.isOperationValid(currentOperationId, canvasId)) {
        console.log(`[Operation ${currentOperationId}] Final operation validation failed, aborting sync`);
        return;
      }

      const logPrefix = `[Operation ${currentOperationId}]`;
      console.log(`${logPrefix} Performing auto-save for canvas ${canvasId} with ${currentData.elements?.length || 0} elements`);

      // Emit sync event with canvas context
      await globalEventBus.emit(InternalEventTypes.SYNC_EXCALIDRAW_DATA, {
        elements: currentData.elements,
        appState: currentData.appState,
        canvasId: canvasId, // Include canvas context for validation
      });

      // Update last sync data and timestamp
      this.lastSyncData = JSON.stringify(currentData);
      this.lastSyncTimestamp = Date.now();
      this.retryCount = 0;

      console.log(
        `${logPrefix} Canvas-aware sync completed successfully for ${canvasId} in ${Date.now() - startTime}ms`,
        {
          elements: currentData.elements?.length || 0,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      console.error(`[ExcalidrawDataBridge] Sync failed for canvas ${canvasId}:`, error);

      // Retry logic with canvas context validation and operation tracking
      if (this.retryCount < this.options.maxRetries && this.currentCanvasContext === canvasId) {
        this.retryCount++;
        const retryOperationId = `retry_${canvasId}_${this.retryCount}_${uuidv4()}`;
        console.log(`[ExcalidrawDataBridge] Retrying sync for canvas ${canvasId} (${this.retryCount}/${this.options.maxRetries}) [${retryOperationId}]`);

        // Generate UUID-based retry key for collision safety
        const retryKey = `${canvasId}_retry_${uuidv4()}`;

        // Register retry operation
        this.pendingOperations.set(retryKey, {
          operationId: retryOperationId,
          canvasId,
          operationType: 'retry',
          timestamp: Date.now(),
          retryCount: this.retryCount,
          parentOperationId: operationId
        });

        // Maintain O(1) lookup map
        this.operationIdMap.set(retryOperationId, retryKey);

        setTimeout(() => {
          // Re-validate canvas context before retry
          if (this.currentCanvasContext === canvasId) {
            this.performSyncForCanvas(canvasId, retryOperationId).finally(() => {
              // Clean up retry operation with UUID-based key
              this.pendingOperations.delete(retryKey);
              this.operationIdMap.delete(retryOperationId);
              console.log(`[Operation ${retryOperationId}] Retry operation cleaned up`);
            });
          } else {
            console.log(`[Operation ${retryOperationId}] Canvas context changed during retry, aborting retry for ${canvasId}`);
            this.pendingOperations.delete(retryKey);
            this.operationIdMap.delete(retryOperationId);
          }
        }, this.options.retryDelay * this.retryCount); // Exponential backoff
      } else {
        console.error(`[ExcalidrawDataBridge] Max retries exceeded for canvas ${canvasId}, sync failed permanently`);
        this.retryCount = 0;

        // Emit error event
        await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
          error: `Auto-sync failed for canvas ${canvasId} after multiple retries`,
          details: error,
        });
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Legacy sync method - delegates to canvas-aware sync
   */
  private async performSync(): Promise<void> {
    if (this.currentCanvasContext) {
      await this.performSyncForCanvas(this.currentCanvasContext);
    } else {
      console.log("[ExcalidrawDataBridge] No canvas context for legacy sync, skipping");
    }
  }

  /**
   * Validate data integrity before sync
   */
  private validateDataIntegrity(data: ExcalidrawData): boolean {
    try {
      // Check if elements array is valid
      if (!Array.isArray(data.elements)) {
        console.warn("[ExcalidrawDataBridge] Invalid elements array");
        return false;
      }

      // Check if all elements have required properties
      for (const element of data.elements) {
        if (!element.id || !element.type) {
          console.warn("[ExcalidrawDataBridge] Invalid element missing id or type:", element);
          return false;
        }
      }

      // Check if appState is valid
      if (!data.appState || typeof data.appState !== 'object') {
        console.warn("[ExcalidrawDataBridge] Invalid appState");
        return false;
      }

      return true;
    } catch (error) {
      console.error("[ExcalidrawDataBridge] Data integrity check failed:", error);
      return false;
    }
  }

  /**
   * Setup localStorage change listener with enhanced handling
   */
  private setupStorageListener(): void {
    window.addEventListener("storage", this.handleStorageChange);

    // Also listen for direct storage mutations (for same-tab changes)
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = (key: string, value: string) => {
      const result = originalSetItem.call(localStorage, key, value);
      if (key === "excalidraw" || key === "excalidraw-state") {
        // Small delay to ensure storage is written
        setTimeout(() => {
          this.handleStorageChange({ key, newValue: value, oldValue: null } as StorageEvent);
        }, 10);
      }
      return result;
    };
  }

  /**
   * Setup theme change listener for filename display updates
   */
  private setupThemeListener(): void {
    this.themeUnsubscribe = globalEventBus.on(InternalEventTypes.THEME_CHANGED, () => {
      // Update filename display when theme changes
      const fileNameDisplay = document.querySelector(".file-name-div") as HTMLElement;
      if (fileNameDisplay && fileNameDisplay.textContent) {
        this.updateFileNameDisplay(fileNameDisplay.textContent);
      }
    });
  }

  /**
   * Enhanced storage change handler with queuing
   */
  private handleStorageChange = (event: StorageEvent): void => {
    if (event.key === "excalidraw" || event.key === "excalidraw-state") {
      console.log("[ExcalidrawDataBridge] Storage change detected:", event.key);

      // Queue the event for processing
      this.storageEventQueue.push(event);

      // Process queue if not already processing
      if (!this.processingQueue) {
        this.processStorageEventQueue();
      }
    }
  };

  /**
   * Process storage events in queue to avoid race conditions
   */
  private async processStorageEventQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.storageEventQueue.length > 0) {
        const event = this.storageEventQueue.shift()!;
        console.log("[ExcalidrawDataBridge] Processing storage event:", event.key);

        // Small delay to ensure Excalidraw has finished writing
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if data has actually changed before syncing
        if (this.hasDataChanged()) {
          this.debouncedSync();
          break; // One sync per batch
        }
      }
    } finally {
      this.processingQueue = false;

      // If more events were queued while processing, process them
      if (this.storageEventQueue.length > 0) {
        setTimeout(() => this.processStorageEventQueue(), 100);
      }
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for load canvas events
    globalEventBus.on(
      InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW,
      async (canvas) => {
        await this.loadCanvasToExcalidraw(canvas, true);
      },
    );
  }

  /**
   * Get enhanced bridge statistics
   */
  getStats(): {
    isInitialized: boolean;
    autoSyncEnabled: boolean;
    lastSyncTime: string | null;
    hasCurrentData: boolean;
    retryCount: number;
    syncInProgress: boolean;
    queuedEvents: number;
    options: ExcalidrawSyncOptions;
  } {
    return {
      isInitialized: this.syncInterval !== null,
      autoSyncEnabled: this.options.autoSave,
      lastSyncTime: this.lastSyncTimestamp ? new Date(this.lastSyncTimestamp).toISOString() : null,
      hasCurrentData: this.getExcalidrawData() !== null,
      retryCount: this.retryCount,
      syncInProgress: this.syncInProgress,
      queuedEvents: this.storageEventQueue.length,
      options: this.options,
    };
  }

  /**
   * Force immediate sync (for testing/debugging)
   */
  async forceSync(): Promise<void> {
    console.log("[ExcalidrawDataBridge] Force sync requested");
    await this.performSync();
  }

  /**
   * Clear sync queue and reset state
   */
  resetSyncState(): void {
    console.log("[ExcalidrawDataBridge] Resetting sync state");
    this.storageEventQueue = [];
    this.retryCount = 0;
    this.syncInProgress = false;
    this.processingQueue = false;
    this.currentCanvasContext = null;

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    // Cancel all pending operations
    this.cancelAllPendingOperations();
  }
}
