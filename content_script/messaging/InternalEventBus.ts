/**
 * Internal Event Bus for Content Script Communication
 * Replaces Chrome messaging API with direct internal communication
 */

import { UnifiedCanvas, UnifiedProject } from "../../shared/types";
import { ExcalidrawElement, AppState } from "../../shared/excalidraw-types";

// Event types for internal communication
export enum InternalEventTypes {
  // Canvas operations
  CANVAS_CREATED = "CANVAS_CREATED",
  CANVAS_UPDATED = "CANVAS_UPDATED",
  CANVAS_DELETED = "CANVAS_DELETED",
  CANVAS_SELECTED = "CANVAS_SELECTED",
  CANVAS_LOADED = "CANVAS_LOADED",
  REQUEST_NEW_CANVAS = "REQUEST_NEW_CANVAS",

  // Project operations
  PROJECT_CREATED = "PROJECT_CREATED",
  PROJECT_UPDATED = "PROJECT_UPDATED",
  PROJECT_DELETED = "PROJECT_DELETED",
  PROJECT_SELECTED = "PROJECT_SELECTED",

  // Excalidraw integration
  LOAD_CANVAS_TO_EXCALIDRAW = "LOAD_CANVAS_TO_EXCALIDRAW",
  SAVE_EXCALIDRAW_DATA = "SAVE_EXCALIDRAW_DATA",
  UPDATE_FILE_NAME_DISPLAY = "UPDATE_FILE_NAME_DISPLAY",
  SYNC_EXCALIDRAW_DATA = "SYNC_EXCALIDRAW_DATA",

  // Panel operations
  PANEL_VISIBILITY_CHANGED = "PANEL_VISIBILITY_CHANGED",
  PANEL_PINNED_CHANGED = "PANEL_PINNED_CHANGED",
  PANEL_WIDTH_CHANGED = "PANEL_WIDTH_CHANGED",

  // UI operations
  SHOW_SEARCH_MODAL = "SHOW_SEARCH_MODAL",
  HIDE_SEARCH_MODAL = "HIDE_SEARCH_MODAL",
  SHOW_PROJECT_MODAL = "SHOW_PROJECT_MODAL",
  HIDE_PROJECT_MODAL = "HIDE_PROJECT_MODAL",
  SHOW_CONTEXT_MENU = "SHOW_CONTEXT_MENU",
  HIDE_CONTEXT_MENU = "HIDE_CONTEXT_MENU",

  // Project context menu
  PROJECT_CONTEXT_MENU_SHOW = "PROJECT_CONTEXT_MENU_SHOW",
  PROJECT_CONTEXT_MENU_HIDE = "PROJECT_CONTEXT_MENU_HIDE",

  // Project operations
  PROJECT_RENAME_REQUEST = "PROJECT_RENAME_REQUEST",
  PROJECT_DELETE_REQUEST = "PROJECT_DELETE_REQUEST",
  PROJECT_EXPORT_REQUEST = "PROJECT_EXPORT_REQUEST",

  // Keyboard shortcuts and actions
  ESCAPE_PRESSED = "ESCAPE_PRESSED",
  SELECT_ALL_REQUEST = "SELECT_ALL_REQUEST",
  SHOW_HELP_OVERLAY = "SHOW_HELP_OVERLAY",
  REFRESH_DATA = "REFRESH_DATA",

  // System operations
  ERROR_OCCURRED = "ERROR_OCCURRED",
  LOADING_STATE_CHANGED = "LOADING_STATE_CHANGED",
  THEME_CHANGED = "THEME_CHANGED",
}

// Event payload types
export interface EventPayloads {
  [InternalEventTypes.CANVAS_CREATED]: UnifiedCanvas;
  [InternalEventTypes.CANVAS_UPDATED]: UnifiedCanvas;
  [InternalEventTypes.CANVAS_DELETED]: UnifiedCanvas;
  [InternalEventTypes.CANVAS_SELECTED]: UnifiedCanvas;
  [InternalEventTypes.CANVAS_LOADED]: UnifiedCanvas;
  [InternalEventTypes.REQUEST_NEW_CANVAS]: null;

  [InternalEventTypes.PROJECT_CREATED]: UnifiedProject;
  [InternalEventTypes.PROJECT_UPDATED]: UnifiedProject;
  [InternalEventTypes.PROJECT_DELETED]: UnifiedProject;
  [InternalEventTypes.PROJECT_SELECTED]: UnifiedProject;

  [InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW]: UnifiedCanvas;
  [InternalEventTypes.SAVE_EXCALIDRAW_DATA]: {
    canvasId: string;
    elements: readonly ExcalidrawElement[];
    appState: AppState;
  };
  [InternalEventTypes.UPDATE_FILE_NAME_DISPLAY]: { fileName: string };
  [InternalEventTypes.SYNC_EXCALIDRAW_DATA]: {
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    canvasId?: string; // Optional canvas context for validation
  };

  [InternalEventTypes.PANEL_VISIBILITY_CHANGED]: { isVisible: boolean };
  [InternalEventTypes.PANEL_PINNED_CHANGED]: { isPinned: boolean };
  [InternalEventTypes.PANEL_WIDTH_CHANGED]: { width: number };

  [InternalEventTypes.SHOW_SEARCH_MODAL]: null;
  [InternalEventTypes.HIDE_SEARCH_MODAL]: null;
  [InternalEventTypes.SHOW_PROJECT_MODAL]: null;
  [InternalEventTypes.HIDE_PROJECT_MODAL]: null;
  [InternalEventTypes.SHOW_CONTEXT_MENU]: {
    x: number;
    y: number;
    canvas: UnifiedCanvas;
  };
  [InternalEventTypes.HIDE_CONTEXT_MENU]: null;

  [InternalEventTypes.PROJECT_CONTEXT_MENU_SHOW]: {
    x: number;
    y: number;
    project: UnifiedProject;
  };
  [InternalEventTypes.PROJECT_CONTEXT_MENU_HIDE]: null;

  [InternalEventTypes.PROJECT_RENAME_REQUEST]: {
    projectId: string;
    oldName: string;
    newName: string;
  };
  [InternalEventTypes.PROJECT_DELETE_REQUEST]: {
    project: UnifiedProject;
    canvasAction: 'keep' | 'delete';
  };
  [InternalEventTypes.PROJECT_EXPORT_REQUEST]: {
    project: UnifiedProject;
  };

  [InternalEventTypes.ESCAPE_PRESSED]: null;
  [InternalEventTypes.SELECT_ALL_REQUEST]: null;
  [InternalEventTypes.SHOW_HELP_OVERLAY]: null;
  [InternalEventTypes.REFRESH_DATA]: null;

  [InternalEventTypes.ERROR_OCCURRED]: { error: string; details?: unknown };
  [InternalEventTypes.LOADING_STATE_CHANGED]: { isLoading: boolean };
  [InternalEventTypes.THEME_CHANGED]: "light" | "dark";
}

// Event handler type
type EventHandler<T extends InternalEventTypes> = (
  payload: EventPayloads[T],
) => void | Promise<void>;

/**
 * Internal Event Bus for content script communication
 * Provides type-safe event emission and subscription
 */
export class InternalEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<string, Set<EventHandler<any>>> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onceListeners: Map<string, Set<EventHandler<any>>> = new Map();
  private debugMode: boolean = false;

  constructor(debug: boolean = false) {
    this.debugMode = debug;
  }

  /**
   * Subscribe to an event
   */
  on<T extends InternalEventTypes>(
    eventType: T,
    handler: EventHandler<T>,
  ): () => void {
    const handlers = this.listeners.get(eventType) || new Set();
    handlers.add(handler);
    this.listeners.set(eventType, handlers);

    if (this.debugMode) {
      console.log(`[EventBus] Subscribed to ${eventType}`);
    }

    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   */
  once<T extends InternalEventTypes>(
    eventType: T,
    handler: EventHandler<T>,
  ): () => void {
    const handlers = this.onceListeners.get(eventType) || new Set();
    handlers.add(handler);
    this.onceListeners.set(eventType, handlers);

    if (this.debugMode) {
      console.log(`[EventBus] Subscribed once to ${eventType}`);
    }

    // Return unsubscribe function
    return () => {
      const onceHandlers = this.onceListeners.get(eventType);
      if (onceHandlers) {
        onceHandlers.delete(handler);
      }
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends InternalEventTypes>(
    eventType: T,
    handler: EventHandler<T>,
  ): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(eventType);
      }
    }

    const onceHandlers = this.onceListeners.get(eventType);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceListeners.delete(eventType);
      }
    }

    if (this.debugMode) {
      console.log(`[EventBus] Unsubscribed from ${eventType}`);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<T extends InternalEventTypes>(
    eventType: T,
    payload: EventPayloads[T],
  ): Promise<void> {
    if (this.debugMode) {
      console.log(`[EventBus] Emitting ${eventType}`, payload);
    }

    // Handle regular listeners
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const promises: Promise<void>[] = [];
      handlers.forEach((handler) => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          console.error(`[EventBus] Error in ${eventType} handler:`, error);
        }
      });

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    }

    // Handle once listeners
    const onceHandlers = this.onceListeners.get(eventType);
    if (onceHandlers) {
      const promises: Promise<void>[] = [];
      const handlersToRemove = Array.from(onceHandlers);

      handlersToRemove.forEach((handler) => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          console.error(
            `[EventBus] Error in ${eventType} once handler:`,
            error,
          );
        }
      });

      // Remove once handlers
      this.onceListeners.delete(eventType);

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    }
  }

  /**
   * Emit an event and collect handler outcomes.
   * Returns ok=false if any handler (regular or once) throws or rejects.
   */
  async emitWithAck<T extends InternalEventTypes>(
    eventType: T,
    payload: EventPayloads[T],
    options?: { requireListener?: boolean; timeoutMs?: number },
  ): Promise<{ ok: boolean; errors: unknown[] }> {
    if (this.debugMode) {
      console.log(`[EventBus] Emitting (ack) ${eventType}`, payload);
    }

    const errors: unknown[] = [];
    const regularCount = this.listeners.get(eventType)?.size || 0;
    const onceCount = this.onceListeners.get(eventType)?.size || 0;
    const listenerCount = regularCount + onceCount;

    if (options?.requireListener && listenerCount === 0) {
      errors.push(new Error(`No listeners for ${String(eventType)}`));
      return { ok: false, errors };
    }

    // Collect promises from both regular and once listeners
    const handlerPromises: Promise<void>[] = [];

    // Regular listeners
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            handlerPromises.push(result);
          }
        } catch (error) {
          console.error(`[EventBus] Error in ${eventType} handler:`, error);
          errors.push(error);
        }
      });
    }

    // Once listeners
    const onceHandlers = this.onceListeners.get(eventType);
    if (onceHandlers) {
      const handlersToRemove = Array.from(onceHandlers);

      handlersToRemove.forEach((handler) => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            handlerPromises.push(result);
          }
        } catch (error) {
          console.error(`[EventBus] Error in ${eventType} once handler:`, error);
          errors.push(error);
        }
      });

      // Remove once handlers
      this.onceListeners.delete(eventType);
    }

    // Await all promises with optional timeout
    if (handlerPromises.length > 0) {
      const awaitAllSettled = async () => {
        const settled = await Promise.allSettled(handlerPromises);
        settled.forEach((res) => {
          if (res.status === "rejected") {
            errors.push(res.reason);
          }
        });
      };

      if (options?.timeoutMs && options.timeoutMs > 0) {
        const timeoutPromise = new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), options.timeoutMs),
        );
        const raced = await Promise.race([
          awaitAllSettled().then(() => "settled" as const),
          timeoutPromise,
        ]);
        if (raced === "timeout") {
          errors.push(
            new Error(
              `Ack timed out for ${String(eventType)} after ${options.timeoutMs}ms`,
            ),
          );
        }
      } else {
        await awaitAllSettled();
      }
    }

    return { ok: errors.length === 0, errors };
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: InternalEventTypes): void {
    if (eventType) {
      this.listeners.delete(eventType);
      this.onceListeners.delete(eventType);
      if (this.debugMode) {
        console.log(`[EventBus] Removed all listeners for ${eventType}`);
      }
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
      if (this.debugMode) {
        console.log("[EventBus] Removed all listeners");
      }
    }
  }

  /**
   * Get number of listeners for an event
   */
  listenerCount(eventType: InternalEventTypes): number {
    const regular = this.listeners.get(eventType)?.size || 0;
    const once = this.onceListeners.get(eventType)?.size || 0;
    return regular + once;
  }

  /**
   * Get all event types that have listeners
   */
  eventNames(): InternalEventTypes[] {
    const allTypes = new Set<InternalEventTypes>();

    this.listeners.forEach((_, eventType) => {
      allTypes.add(eventType as InternalEventTypes);
    });

    this.onceListeners.forEach((_, eventType) => {
      allTypes.add(eventType as InternalEventTypes);
    });

    return Array.from(allTypes);
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

}

// Singleton instance for global use
export const eventBus = new InternalEventBus(
  // Enable debug mode in development
  typeof window !== "undefined" && window.location.hostname === "localhost",
);

// Export convenience functions
export const { on, once, off, emit, emitWithAck, removeAllListeners } = eventBus;

// Keep backward compatibility
export const globalEventBus = eventBus;
