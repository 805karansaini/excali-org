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
    const shortcuts = getExtensionShortcuts();
    const helpText = Object.entries(shortcuts.shortcuts)
      .map(([action, shortcut]) => `${action}: ${shortcut}`)
      .join('\n');

    alert(`Excali Organizer Keyboard Shortcuts:\n\n${helpText}`);
  }, []);

  const handleNewCanvasShortcut = useCallback(async () => {
    try {
      console.log("Creating new canvas from keyboard shortcut...");

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

      console.log("New canvas created:", newCanvas);

      // Create the canvas using the existing createCanvas function
      const createdCanvas = await createCanvas(newCanvas);
      console.log("Canvas created successfully:", createdCanvas);

      // Select the new canvas
      dispatch({ type: "SET_SELECTED_CANVAS", payload: createdCanvas.id });

      // Emit events
      eventBus.emit(InternalEventTypes.CANVAS_CREATED, createdCanvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, createdCanvas);

      console.log("Canvas creation completed successfully via keyboard shortcut");
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
    console.log("DEBUG: handleDuplicateSelected called");
    console.log("DEBUG: selectedCanvasId:", state.selectedCanvasId);
    console.log("DEBUG: currentWorkingCanvasId:", state.currentWorkingCanvasId);
    console.log("DEBUG: canvases length:", state.canvases.length);

    // Try to use currentWorkingCanvasId first (the canvas that's currently loaded in Excalidraw)
    // If that's not available, fall back to selectedCanvasId
    const canvasIdToUse = state.currentWorkingCanvasId || state.selectedCanvasId;

    if (!canvasIdToUse) {
      console.log("DEBUG: No current working canvas or selected canvas, cannot duplicate");
      alert("Please load a canvas first to duplicate it.");
      return;
    }

    const canvas = state.canvases.find((c) => c.id === canvasIdToUse);
    if (!canvas) {
      console.log("DEBUG: Canvas not found in state, ID:", canvasIdToUse);
      alert("Current canvas not found.");
      return;
    }

    try {
      console.log("DEBUG: Duplicating canvas:", canvas.name);
      const newCanvas = await createCanvas({
        ...canvas,
        name: `${canvas.name} (Copy)`,
        projectId: undefined,
        elements: canvas.elements || [],
        excalidraw: canvas.excalidraw || [],
        appState: canvas.appState,
      });
      console.log("DEBUG: Canvas duplicated successfully:", newCanvas);
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

      // Debug: Log all key combinations with Alt or Cmd+Shift
      if (altKey || (ctrlCmdKey && shiftKey)) {
        console.log("DEBUG: Key combination detected:", {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          altKey,
          shiftKey,
          ctrlCmdKey,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          target: (e.target as HTMLElement)?.tagName,
          currentTarget: (e.currentTarget as HTMLElement)?.tagName,
          isTyping: isTyping()
        });
      }

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
        console.log("DEBUG: New Project shortcut triggered!", {
          onNewProject: typeof onNewProject,
          onNewProjectFunction: onNewProject.toString()
        });
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          onNewProject();
          console.log("DEBUG: onNewProject() called successfully");
        } catch (error) {
          console.error("DEBUG: Error calling onNewProject:", error);
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
        console.log("DEBUG: Alt + N shortcut triggered!");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleNewCanvasShortcut();
        return;
      }

      // Duplicate Canvas: Ctrl/Cmd + Shift + D (works even when typing)
      if (ctrlCmdKey && shiftKey && !altKey && e.key.toLowerCase() === "d") {
        console.log("DEBUG: Cmd + Shift + D shortcut triggered!");
        console.log("DEBUG: handleDuplicateSelected function:", handleDuplicateSelected);
        console.log("DEBUG: selectedCanvasId:", state.selectedCanvasId);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          handleDuplicateSelected();
          console.log("DEBUG: handleDuplicateSelected() called successfully");
        } catch (error) {
          console.error("DEBUG: Error calling handleDuplicateSelected:", error);
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

    console.log("DEBUG: Setting up keyboard shortcuts event listener");
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      console.log("DEBUG: Removing keyboard shortcuts event listener");
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    state.contextMenu,
    state.isSearchModalOpen,
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
