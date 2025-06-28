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

      // Prepare Excalidraw data
      const excalidrawData: ExcalidrawData = {
        elements: canvas.elements || canvas.excalidraw || [],
        appState: canvas.appState || {
          viewBackgroundColor: '#ffffff',
          currentItemFontSize: 20,
          currentItemStrokeColor: '#000000',
          currentItemBackgroundColor: 'transparent',
          currentItemStrokeWidth: 1,
          currentItemStrokeStyle: 'solid',
          currentItemRoughness: 1,
          currentItemOpacity: 100,
          currentItemFontFamily: 1,
          currentItemTextAlign: 'left',
          currentItemArrowhead: 'arrow',
          currentItemLinearStrokeSharpness: 'round',
          gridSize: null,
          colorPalette: {},
        }
      };

      // Set Excalidraw localStorage
      this.setExcalidrawData(excalidrawData);

      // Update file name display
      await this.updateFileNameDisplay(canvas.name);

      // Store current canvas data for sync comparison
      this.lastSyncData = JSON.stringify(excalidrawData);

      // Emit event
      await globalEventBus.emit(InternalEventTypes.CANVAS_LOADED, { canvas });

      // Reload Excalidraw to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 100);

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
      // Try multiple localStorage keys that Excalidraw might use
      const keys = ['excalidraw', 'excalidraw-state', 'excalidraw-app-state'];
      
      for (const key of keys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && (parsed.elements || parsed.type === 'excalidraw')) {
              return {
                elements: parsed.elements || [],
                appState: parsed.appState || {},
                files: parsed.files
              };
            }
          } catch (parseError) {
            console.warn(`[ExcalidrawDataBridge] Failed to parse ${key}:`, parseError);
          }
        }
      }

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
      // Set the main Excalidraw data
      const excalidrawState = {
        type: 'excalidraw',
        version: 2,
        source: 'excalidraw-file-manager',
        elements: data.elements,
        appState: data.appState,
        files: data.files
      };

      localStorage.setItem('excalidraw', JSON.stringify(excalidrawState));
      
      // Also set app state separately if needed
      if (data.appState) {
        localStorage.setItem('excalidraw-app-state', JSON.stringify(data.appState));
      }

      console.log('[ExcalidrawDataBridge] Set Excalidraw data successfully');
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
      if (!currentData) return false;

      const currentDataString = JSON.stringify(currentData);
      const hasChanged = currentDataString !== this.lastSyncData;
      
      if (hasChanged) {
        console.log('[ExcalidrawDataBridge] Data change detected');
      }

      return hasChanged;
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
    globalEventBus.on(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, async ({ canvas }) => {
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