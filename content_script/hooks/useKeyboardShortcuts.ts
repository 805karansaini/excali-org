import { useEffect, useCallback } from "react";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";

interface KeyboardShortcutsProps {
  onNewCanvas: () => void;
  onNewProject: () => void;
  onTogglePanel?: () => void;
}

export function getExtensionShortcuts() {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modifier = isMac ? "⌥" : "Alt";
  const ctrlCmd = isMac ? "⌘" : "Ctrl";

  return {
    shortcuts: {
      "Toggle Panel": `${ctrlCmd} + B`,
      "Navigate Canvases": `${ctrlCmd} + ${modifier} + ↑/↓`,
      "Close Modals / Focus Panel": "Escape",
      "New Canvas": `${modifier} + N`,
      "Duplicate Canvas": `${ctrlCmd} + Shift + D`,
      "Delete Canvas": `${modifier} + Delete`,
      "Rename Canvas": `F2`,
      "New Project": `${modifier} + Shift + N`,
      Search: `${ctrlCmd} + Shift + F`,
      "Refresh Data": `${modifier} + F5`,
      Help: `F1`,
    },
    modifiers: {
      modifier,
      ctrlCmd,
    },
  };
}

export function useKeyboardShortcuts({
  onNewCanvas,
  onNewProject,
  onTogglePanel,
}: KeyboardShortcutsProps) {
  const { state, dispatch, saveCanvas, removeCanvas, createCanvas } =
    useUnifiedState();

  const showHelpDialog = useCallback(() => {
    dispatch({ type: "SET_HELP_MODAL_OPEN", payload: true });
  }, [dispatch]);

  const handleNewCanvasShortcut = useCallback(async () => {
    try {
      const existingNames = state.canvases.map((c) => c.name);
      const baseName = "Untitled Canvas";
      let counter = 1;
      let finalName = baseName;

      // Find unique name
      while (existingNames.includes(finalName)) {
        finalName = `${baseName} ${counter}`;
        counter++;
      }

      const newCanvas = {
        name: finalName,
        elements: [],
        excalidraw: [], // Required for backward compatibility
        appState: {
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
          currentItemFontSize: 20,
          currentItemStrokeColor: "#000000",
        },
        lastModified: new Date().toISOString(),
        projectId: undefined,
      };

      // Create the canvas using the existing createCanvas function
      const createdCanvas = await createCanvas(newCanvas);

      // Select the new canvas
      dispatch({ type: "SET_SELECTED_CANVAS", payload: createdCanvas.id });

      // Emit events
      eventBus.emit(InternalEventTypes.CANVAS_CREATED, createdCanvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, createdCanvas);
    } catch (error) {
      console.error("Error creating new canvas via keyboard shortcut:", error);
      // Show error to user
      dispatch({
        type: "SET_ERROR",
        payload:
          "Failed to create canvas: " +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }, [state.canvases, dispatch, createCanvas]);

  const isTyping = useCallback(() => {
    const activeElement = document.activeElement;
    return (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.hasAttribute("contenteditable") ||
        activeElement.closest("[contenteditable]") ||
        activeElement.closest(".excalidraw") ||
        activeElement.closest(".App-center"))
    );
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (!state.selectedCanvasId) return;
    const selectedCanvas = state.canvases.find(
      (c) => c.id === state.selectedCanvasId,
    );
    if (!selectedCanvas) return;

    if (
      confirm(
        `Are you sure you want to delete "${selectedCanvas.name}"?\n\nThis action cannot be undone.`,
      )
    ) {
      try {
        await removeCanvas(selectedCanvas.id);
        eventBus.emit(InternalEventTypes.CANVAS_DELETED, selectedCanvas);
        dispatch({ type: "SET_SELECTED_CANVAS", payload: null });
      } catch (error) {
        console.error("Failed to delete canvas via keyboard shortcut:", error);
        alert("Failed to delete canvas. Please try again.");
      }
    }
  }, [state.selectedCanvasId, state.canvases, removeCanvas, dispatch]);

  const handleDuplicateSelected = useCallback(async () => {
    // Try to use currentWorkingCanvasId first (the canvas that's currently loaded in Excalidraw)
    // If that's not available, fall back to selectedCanvasId
    const canvasIdToUse = state.currentWorkingCanvasId || state.selectedCanvasId;

    if (!canvasIdToUse) {
      alert("Please load a canvas first to duplicate it.");
      return;
    }

    const canvas = state.canvases.find((c) => c.id === canvasIdToUse);
    if (!canvas) {
      alert("Current canvas not found.");
      return;
    }

    try {
      const newCanvas = await createCanvas({
        ...canvas,
        name: `${canvas.name} (Copy)`,
        projectId: undefined,
        elements: canvas.elements || [],
        excalidraw: canvas.excalidraw || [],
        appState: canvas.appState,
      });
      eventBus.emit(InternalEventTypes.CANVAS_CREATED, newCanvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, newCanvas);
      dispatch({ type: "SET_SELECTED_CANVAS", payload: newCanvas.id });
    } catch (error) {
      console.error(
        "Failed to duplicate canvas via keyboard shortcut:",
        error,
      );
      alert("Failed to duplicate canvas. Please try again.");
    }
  }, [state.selectedCanvasId, state.currentWorkingCanvasId, state.canvases, createCanvas, dispatch]);

  const handleRenameSelected = useCallback(async () => {
    if (!state.selectedCanvasId) return;
    const selectedCanvas = state.canvases.find(
      (c) => c.id === state.selectedCanvasId,
    );
    if (!selectedCanvas) return;

    const newName = prompt("Enter new name:", selectedCanvas.name);
    if (newName && newName.trim() !== selectedCanvas.name) {
      const updatedCanvas = {
        ...selectedCanvas,
        name: newName.trim(),
        updatedAt: new Date(),
      };
      try {
        await saveCanvas(updatedCanvas);
        eventBus.emit(InternalEventTypes.CANVAS_UPDATED, updatedCanvas);
      } catch (error) {
        console.error("Failed to rename canvas via keyboard shortcut:", error);
        alert("Failed to rename canvas. Please try again.");
      }
    }
  }, [state.selectedCanvasId, state.canvases, saveCanvas]);

  const handleNavigateCanvases = useCallback(
    (direction: "next" | "prev") => {
      const visibleCanvases = state.canvases
        .filter(() => true)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime(),
        );

      if (visibleCanvases.length === 0) return;

      const currentIndex = state.selectedCanvasId
        ?
        visibleCanvases.findIndex((c) => c.id === state.selectedCanvasId)
        : -1;

      let newIndex;
      if (direction === "next") {
        newIndex =
          currentIndex < visibleCanvases.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex =
          currentIndex > 0 ? currentIndex - 1 : visibleCanvases.length - 1;
      }

      const nextCanvas = visibleCanvases[newIndex];
      if (nextCanvas) {
        dispatch({ type: "SET_SELECTED_CANVAS", payload: nextCanvas.id });
        eventBus.emit(InternalEventTypes.CANVAS_SELECTED, nextCanvas);
        eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, nextCanvas);
      }
    },
    [state.canvases, state.selectedCanvasId, dispatch],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const altKey = e.altKey;
      const ctrlCmdKey = isMac ? e.metaKey : e.ctrlKey;
      const shiftKey = e.shiftKey;


      // Universal Search Shortcut (works even when typing)
      if (ctrlCmdKey && shiftKey && !altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: true });
        return;
      }

      // New Project: Alt/Option + Shift + N (works even when typing)
      if (altKey && shiftKey && !ctrlCmdKey && (e.key.toLowerCase() === "n" || e.code === "KeyN")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          onNewProject();
        } catch (error) {
          console.error("Error calling onNewProject:", error);
        }
        return;
      }

      // Close Modals / Focus Panel: Escape
      if (!ctrlCmdKey && !altKey && !shiftKey && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (state.contextMenu) {
          dispatch({ type: "SET_CONTEXT_MENU", payload: null });
        } else if (state.isHelpModalOpen) {
          dispatch({ type: "SET_HELP_MODAL_OPEN", payload: false });
        } else if (state.isSearchModalOpen) {
          dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: false });
        }
        eventBus.emit(InternalEventTypes.ESCAPE_PRESSED, null);
        return;
      }

      // Toggle Panel: Ctrl/Cmd + B
      if (ctrlCmdKey && !altKey && !shiftKey && e.key === "b") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onTogglePanel?.();
        return;
      }

      // New Canvas: Alt + N (works even when typing)
      if (altKey && !ctrlCmdKey && !shiftKey && (e.key.toLowerCase() === "n" || e.code === "KeyN")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleNewCanvasShortcut();
        return;
      }

      // Duplicate Canvas: Ctrl/Cmd + Shift + D (works even when typing)
      if (ctrlCmdKey && shiftKey && !altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          handleDuplicateSelected();
        } catch (error) {
          console.error("Error calling handleDuplicateSelected:", error);
        }
        return;
      }

      // Help: F1 (works even when typing)
      if (!altKey && !ctrlCmdKey && !shiftKey && e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showHelpDialog();
        return;
      }

      // TODO Later
      if (isTyping()) return;

      // Navigate Canvases: Ctrl/Cmd + Alt + Up/Down
      if (
        ctrlCmdKey &&
        altKey &&
        !shiftKey &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleNavigateCanvases(e.key === "ArrowDown" ? "next" : "prev");
        return;
      }



      // Delete Canvas: Alt + Delete
      if (altKey && !ctrlCmdKey && !shiftKey && e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleDeleteSelected();
        return;
      }

      // Rename Canvas: F2
      if (!altKey && !ctrlCmdKey && !shiftKey && e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleRenameSelected();
        return;
      }


      // Refresh Data: Alt + F5
      if (altKey && !ctrlCmdKey && !shiftKey && e.key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        eventBus.emit(InternalEventTypes.REFRESH_DATA, null);
        return;
      }

    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    state.contextMenu,
    state.isSearchModalOpen,
    state.isHelpModalOpen,
    isTyping,
    dispatch,
    onNewCanvas,
    onNewProject,
    onTogglePanel,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRenameSelected,
    handleNavigateCanvases,
    showHelpDialog,
    handleNewCanvasShortcut,
  ]);

  return getExtensionShortcuts();
}
