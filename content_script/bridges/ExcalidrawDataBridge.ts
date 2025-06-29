/**
 * ExcalidrawDataBridge - Handles synchronization between the file manager and Excalidraw
 * Manages canvas loading, saving, and real-time sync with Excalidraw's localStorage
 */

import { UnifiedCanvas } from '../../shared/types';
import { globalEventBus, InternalEventTypes } from '../messaging/InternalEventBus';

export interface ExcalidrawData {
  elements: any[];
  appState: any;
  files?: any;
}

export interface ExcalidrawSyncOptions {
  autoSave: boolean;
  syncInterval: number; // milliseconds
  debounceDelay: number; // milliseconds
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

  constructor(options: Partial<ExcalidrawSyncOptions> = {}) {
    this.options = {
      autoSave: true,
      syncInterval: 5000, // 5 seconds
      debounceDelay: 1000, // 1 second
      ...options
    };

    this.setupEventListeners();
  }

  /**
 * Initialize the bridge and start monitoring
 */
  initialize(): void {
    console.log('[ExcalidrawDataBridge] Initializing bridge...');

    // Initialize last sync data with current Excalidraw data if it exists
    try {
      const currentData = this.getExcalidrawData();
      if (currentData) {
        this.lastSyncData = JSON.stringify(currentData);
        console.log('[ExcalidrawDataBridge] Initialized with existing Excalidraw data');
      } else {
        console.log('[ExcalidrawDataBridge] No existing Excalidraw data found');
      }
    } catch (error) {
      console.warn('[ExcalidrawDataBridge] Failed to initialize with existing data:', error);
    }

    if (this.options.autoSave) {
      this.startAutoSync();
    }

    // Listen for Excalidraw data changes
    this.setupStorageListener();
  }

  /**
   * Cleanup bridge resources
   */
  destroy(): void {
    console.log('[ExcalidrawDataBridge] Destroying bridge...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    // Remove event listeners
    window.removeEventListener('storage', this.handleStorageChange);
  }

  /**
   * Load a canvas into Excalidraw
   */
  async loadCanvasToExcalidraw(canvas: UnifiedCanvas): Promise<void> {
    try {
      console.log('[ExcalidrawDataBridge] Loading canvas to Excalidraw:', canvas.name);

      this.isLoading = true;

      // Prepare Excalidraw data with proper element structure
      let elements = canvas.elements || canvas.excalidraw || [];

      // Ensure all elements have required properties for Excalidraw
      elements = elements.map((element, index) => ({
        // Required base properties
        id: element.id || `element_${Date.now()}_${index}`,
        type: element.type || 'rectangle',
        x: element.x || 0,
        y: element.y || 0,
        width: element.width || 100,
        height: element.height || 100,
        angle: element.angle || 0,

        // Style properties with defaults
        strokeColor: element.strokeColor || '#000000',
        backgroundColor: element.backgroundColor || 'transparent',
        fillStyle: element.fillStyle || 'hachure',
        strokeWidth: element.strokeWidth || 1,
        strokeStyle: element.strokeStyle || 'solid',
        roughness: element.roughness || 1,
        opacity: element.opacity || 100,

        // Array properties
        groupIds: element.groupIds || [],

        // Object/null properties
        frameId: element.frameId || null,
        roundness: element.roundness || null,
        boundElements: element.boundElements || null,
        link: element.link || null,

        // Version/state properties
        seed: element.seed || Math.floor(Math.random() * 2147483647),
        versionNonce: element.versionNonce || Math.floor(Math.random() * 2147483647),
        isDeleted: element.isDeleted || false,
        updated: element.updated || 1,
        locked: element.locked || false,

        // Preserve any other existing properties
        ...element
      }));

      const excalidrawData: ExcalidrawData = {
        elements: elements,
        appState: canvas.appState || {},
        files: {} // Files are handled separately in Excalidraw
      };

      // Set Excalidraw localStorage
      this.setExcalidrawData(excalidrawData);

      // Store current canvas data for sync comparison
      this.lastSyncData = JSON.stringify(excalidrawData);

      // Emit loading event
      await globalEventBus.emit(InternalEventTypes.CANVAS_LOADED, canvas);

      // Give a small delay to ensure localStorage is written before reload
      console.log('[ExcalidrawDataBridge] Canvas data prepared, reloading page to load canvas:', canvas.name);

      setTimeout(() => {
        // Update file name display just before reload
        this.updateFileNameDisplay(canvas.name).then(() => {
          // Reload page to ensure Excalidraw loads the new data reliably
          window.location.reload();
        }).catch(() => {
          // Even if file name update fails, still reload
          window.location.reload();
        });
      }, 100); // Small delay to ensure localStorage write completes

    } catch (error) {
      console.error('[ExcalidrawDataBridge] Failed to load canvas:', error);
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: 'Failed to load canvas into Excalidraw',
        details: error
      });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Save current Excalidraw data to a canvas
   */
  async saveExcalidrawData(canvasId: string): Promise<ExcalidrawData | null> {
    try {
      const excalidrawData = this.getExcalidrawData();
      if (!excalidrawData) {
        console.warn('[ExcalidrawDataBridge] No Excalidraw data found to save');
        return null;
      }

      // Emit save event
      await globalEventBus.emit(InternalEventTypes.SAVE_EXCALIDRAW_DATA, {
        canvasId,
        elements: excalidrawData.elements,
        appState: excalidrawData.appState
      });

      return excalidrawData;

    } catch (error) {
      console.error('[ExcalidrawDataBridge] Failed to save Excalidraw data:', error);
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: 'Failed to save Excalidraw data',
        details: error
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
      const elementsData = localStorage.getItem('excalidraw');
      let elements = [];

      if (elementsData) {
        try {
          const parsed = JSON.parse(elementsData);
          if (Array.isArray(parsed)) {
            elements = parsed;
            console.log('[ExcalidrawDataBridge] Found', elements.length, 'elements in localStorage');
          } else {
            console.warn('[ExcalidrawDataBridge] Excalidraw data is not an array:', typeof parsed);
          }
        } catch (parseError) {
          console.warn('[ExcalidrawDataBridge] Failed to parse excalidraw elements data:', parseError);
        }
      }

      // Get appState from excalidraw-state key
      let appState = {};
      const stateData = localStorage.getItem('excalidraw-state');
      if (stateData) {
        try {
          appState = JSON.parse(stateData);
          console.log('[ExcalidrawDataBridge] Found appState in excalidraw-state');
        } catch (parseError) {
          console.warn('[ExcalidrawDataBridge] Failed to parse excalidraw-state:', parseError);
        }
      }

      // Only return data if we have elements or meaningful appState
      if (elements.length > 0 || Object.keys(appState).length > 0) {
        return {
          elements: elements,
          appState: appState,
          files: {} // Files are typically stored elsewhere
        };
      }

      console.log('[ExcalidrawDataBridge] No valid Excalidraw data found');
      return null;
    } catch (error) {
      console.error('[ExcalidrawDataBridge] Failed to get Excalidraw data:', error);
      return null;
    }
  }

  /**
   * Set Excalidraw data to localStorage
   */
  private setExcalidrawData(data: ExcalidrawData): void {
    try {
      console.log('[ExcalidrawDataBridge] Setting Excalidraw data with', data.elements?.length || 0, 'elements');

      // CRITICAL FIX: Excalidraw expects just an array of elements, not an object
      const elementsArray = data.elements || [];

      // Set the main localStorage key with just the elements array
      localStorage.setItem('excalidraw', JSON.stringify(elementsArray));

      // Store appState separately if it exists (Excalidraw uses excalidraw-state for this)
      if (data.appState && Object.keys(data.appState).length > 0) {
        // Get existing state and merge with our appState
        let existingState = {};
        try {
          const existing = localStorage.getItem('excalidraw-state');
          if (existing) {
            existingState = JSON.parse(existing);
          }
        } catch (e) {
          console.warn('[ExcalidrawDataBridge] Failed to parse existing state:', e);
        }

        const mergedState = {
          ...existingState,
          ...data.appState
        };

        localStorage.setItem('excalidraw-state', JSON.stringify(mergedState));
        console.log('[ExcalidrawDataBridge] Updated excalidraw-state with appState');
      }

      console.log('[ExcalidrawDataBridge] Successfully set Excalidraw data (elements array format) with', elementsArray.length, 'elements');
    } catch (error) {
      console.error('[ExcalidrawDataBridge] Failed to set Excalidraw data:', error);
      throw error;
    }
  }



  /**
   * Update the file name display on the Excalidraw page
   */
  async updateFileNameDisplay(fileName: string): Promise<void> {
    try {
      // Remove existing file name display
      const existingDisplay = document.querySelector('.file-name-div');
      if (existingDisplay) {
        existingDisplay.remove();
      }

      // Create new file name display
      const fileNameDiv = document.createElement('div');
      fileNameDiv.classList.add('file-name-div');
      fileNameDiv.textContent = fileName;

      // Style for dark theme integration (matches Excalidraw's theme)
      fileNameDiv.style.cssText = `
        position: absolute;
        top: 5px;
        left: 48px;
        background-color: rgba(35, 35, 41, 0.9);
        color: rgba(222, 222, 227, 1);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 500;
        z-index: 1000;
        pointer-events: none;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;

      // Find Excalidraw container and append
      const excalidrawContainer = document.querySelector('.App-menu') || document.querySelector('.App') || document.body;
      if (excalidrawContainer) {
        excalidrawContainer.appendChild(fileNameDiv);
      }

      // Emit event
      await globalEventBus.emit(InternalEventTypes.UPDATE_FILE_NAME_DISPLAY, { fileName });

    } catch (error) {
      console.error('[ExcalidrawDataBridge] Failed to update file name display:', error);
    }
  }

  /**
 * Check if current data has changed
 */
  private hasDataChanged(): boolean {
    try {
      const currentData = this.getExcalidrawData();
      if (!currentData) {
        console.log('[ExcalidrawDataBridge] No current data found for change detection');
        return false;
      }

      // If we have no previous data, consider it changed
      if (!this.lastSyncData) {
        console.log('[ExcalidrawDataBridge] No previous sync data, considering as changed');
        return true;
      }

      // Compare elements count and IDs for more accurate change detection
      const currentElementsCount = currentData.elements?.length || 0;
      const currentElementIds = currentData.elements?.map((el: any) => el.id).sort() || [];

      let lastElementsCount = 0;
      let lastElementIds: string[] = [];

      try {
        const lastData = JSON.parse(this.lastSyncData);
        lastElementsCount = lastData.elements?.length || 0;
        lastElementIds = lastData.elements?.map((el: any) => el.id).sort() || [];
      } catch (e) {
        console.log('[ExcalidrawDataBridge] Failed to parse last sync data, considering as changed');
        return true;
      }

      // Check if count changed
      if (currentElementsCount !== lastElementsCount) {
        console.log('[ExcalidrawDataBridge] Element count changed:', lastElementsCount, '->', currentElementsCount);
        return true;
      }

      // Check if element IDs changed (elements added/removed/modified)
      const idsChanged = JSON.stringify(currentElementIds) !== JSON.stringify(lastElementIds);
      if (idsChanged) {
        console.log('[ExcalidrawDataBridge] Element IDs changed');
        return true;
      }

      // No significant changes detected
      return false;
    } catch (error) {
      console.error('[ExcalidrawDataBridge] Error checking data changes:', error);
      return false;
    }
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

    console.log('[ExcalidrawDataBridge] Auto-sync started');
  }

  /**
   * Debounced sync to avoid excessive saves
   */
  private debouncedSync(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(async () => {
      try {
        const currentData = this.getExcalidrawData();
        if (currentData) {
          await globalEventBus.emit(InternalEventTypes.SYNC_EXCALIDRAW_DATA, {
            elements: currentData.elements,
            appState: currentData.appState
          });

          this.lastSyncData = JSON.stringify(currentData);
        }
      } catch (error) {
        console.error('[ExcalidrawDataBridge] Auto-sync failed:', error);
      }
    }, this.options.debounceDelay);
  }

  /**
   * Setup localStorage change listener
   */
  private setupStorageListener(): void {
    window.addEventListener('storage', this.handleStorageChange);
  }

  /**
   * Handle localStorage changes
   */
  private handleStorageChange = (event: StorageEvent): void => {
    if (event.key === 'excalidraw' || event.key === 'excalidraw-state') {
      console.log('[ExcalidrawDataBridge] Storage change detected:', event.key);
      this.debouncedSync();
    }
  };

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for load canvas events
    globalEventBus.on(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, async (canvas) => {
      await this.loadCanvasToExcalidraw(canvas);
    });
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    isInitialized: boolean;
    autoSyncEnabled: boolean;
    lastSyncTime: string | null;
    hasCurrentData: boolean;
  } {
    return {
      isInitialized: this.syncInterval !== null,
      autoSyncEnabled: this.options.autoSave,
      lastSyncTime: this.lastSyncData ? new Date().toISOString() : null,
      hasCurrentData: this.getExcalidrawData() !== null
    };
  }
}
