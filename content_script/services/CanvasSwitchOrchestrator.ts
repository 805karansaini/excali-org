import { UnifiedCanvas } from "../../shared/types";
import { globalEventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { ExcalidrawDataBridge } from "../bridges/ExcalidrawDataBridge";
import { settingsOperations } from "../../shared/unified-db";

/**
 * CanvasSwitchOrchestrator
 * - Debounces rapid selections
 * - Performs save-before-switch with timeout
 * - Suspends autosync to avoid cross-canvas races
 * - Loads target canvas atomically via ExcalidrawDataBridge
 */
export class CanvasSwitchOrchestrator {
  private bridge: ExcalidrawDataBridge;
  private debounceMs = 250; // coalesce rapid clicks
  private saveTimeoutMs = 900; // explicit save upper bound

  private isSwitching = false;
  private pendingTarget: UnifiedCanvas | null = null;
  private debounceTimer: number | null = null;

  constructor(bridge: ExcalidrawDataBridge) {
    this.bridge = bridge;
  }

  initialize(): void {
    // Centralize switching on CANVAS_SELECTED
    globalEventBus.on(InternalEventTypes.CANVAS_SELECTED, (canvas) => {
      this.queueSwitch(canvas);
    });

    // Backward-compat: if anything still emits LOAD_CANVAS_TO_EXCALIDRAW, treat it as selection
    globalEventBus.on(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, (canvas) => {
      this.queueSwitch(canvas);
    });
  }

  private queueSwitch(target: UnifiedCanvas): void {
    this.pendingTarget = target;

    // Debounce to coalesce rapid selections
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      if (!this.isSwitching && this.pendingTarget) {
        void this.performSwitch(this.pendingTarget);
      }
    }, this.debounceMs);
  }

  private async performSwitch(target: UnifiedCanvas): Promise<void> {
    this.isSwitching = true;

    try {
      // Suspend autosync to avoid races from storage events during switch
      this.bridge.suspendAutoSync("switch");

      // Determine the current working canvas id from settings
      const currentId = await settingsOperations.getSetting<string>("currentWorkingCanvasId");

      // Attempt explicit save of current canvas before switching
      if (currentId) {
        const snapshot = this.bridge.getExcalidrawData();
        if (snapshot) {
          await this.saveWithTimeout(currentId, snapshot.elements, snapshot.appState as import("../../shared/excalidraw-types").AppState);
        }
      }

      // If a newer target arrived while we were saving, prefer the latest
      const latest = this.pendingTarget || target;

      // Load the target canvas and force reload for a clean pickup
      await this.bridge.loadCanvasToExcalidraw(latest, true);
      // After this call, the page will reload shortly; orchestrator instance will be re-created
    } catch (error) {
      // Report but do not throw to keep UI responsive
      await globalEventBus.emit(InternalEventTypes.ERROR_OCCURRED, {
        error: "Canvas switch failed",
        details: error,
      });
    } finally {
      this.isSwitching = false;
      this.pendingTarget = null;

      // In case reload didn’t happen (forceReload disabled), resume autosync
      this.bridge.resumeAutoSync("switch");
    }
  }

  private async saveWithTimeout(
    canvasId: string,
    elements: UnifiedCanvas["elements"],
    appState: import("../../shared/excalidraw-types").AppState,
  ): Promise<void> {
    const savePromise = globalEventBus.emit(InternalEventTypes.SYNC_EXCALIDRAW_DATA, {
      elements,
      appState,
      canvasId,
    });

    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, this.saveTimeoutMs);
    });

    // Race: proceed after first settles (explicit save or timeout)
    await Promise.race([savePromise.then(() => undefined), timeout]);
  }
}
