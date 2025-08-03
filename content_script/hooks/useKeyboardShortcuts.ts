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
      // TODO-later: Navigate Canvases functionality may be added back later
      // "Navigate Canvases": `${ctrlCmd} + ${modifier} + ↑/↓`,
      "Close Modals / Focus Panel": "Escape",
      "New Canvas": `${modifier} + N`,
      "Duplicate Canvas": `${ctrlCmd} + Shift + D`,
      "Delete Canvas": `${modifier} + Delete`,
      "Rename Canvas": `F2`,
      "New Project": `${modifier} + Shift + N`,
      Search: `${ctrlCmd} + Shift + F`,
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
  const { state, dispatch, createCanvas } =
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

      while (existingNames.includes(finalName)) {
        finalName = `${baseName} ${counter}`;
        counter++;
      }

      const newCanvas = {
        name: finalName,
        elements: [],
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
      };

      const createdCanvas = await createCanvas(newCanvas);

      dispatch({ type: "SET_SELECTED_CANVAS", payload: createdCanvas.id });

      eventBus.emit(InternalEventTypes.CANVAS_CREATED, createdCanvas);
      eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, createdCanvas);
    } catch (error) {
      console.error("Error creating new canvas via keyboard shortcut:", error);
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
    // Try to use currentWorkingCanvasId first (the canvas that's currently loaded in Excalidraw)
    // If that's not available, fall back to selectedCanvasId
    const canvasIdToUse = state.currentWorkingCanvasId || state.selectedCanvasId;

    if (!canvasIdToUse) {
      alert("Please select a canvas first to delete it.");
      return;
    }

    const canvas = state.canvases.find((c) => c.id === canvasIdToUse);
    if (!canvas) {
      alert("Selected canvas not found.");
      return;
    }

    dispatch({ type: "SET_CANVAS_TO_DELETE", payload: canvas });
    dispatch({ type: "SET_CANVAS_DELETE_MODAL_OPEN", payload: true });
  }, [state.selectedCanvasId, state.currentWorkingCanvasId, state.canvases, dispatch]);

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { projectId, ...canvasWithoutProject } = canvas;
      const newCanvas = await createCanvas({
        ...canvasWithoutProject,
        name: `${canvas.name} (Copy)`,
        elements: canvas.elements || [],
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
    // Try to use currentWorkingCanvasId first (the canvas that's currently loaded in Excalidraw)
    // If that's not available, fall back to selectedCanvasId
    const canvasIdToUse = state.currentWorkingCanvasId || state.selectedCanvasId;

    if (!canvasIdToUse) {
      alert("Please select a canvas first to rename it.");
      return;
    }

    const canvas = state.canvases.find((c) => c.id === canvasIdToUse);
    if (!canvas) {
      alert("Selected canvas not found.");
      return;
    }

    dispatch({ type: "SET_CANVAS_TO_RENAME", payload: canvas });
    dispatch({ type: "SET_RENAME_MODAL_OPEN", payload: true });
  }, [state.selectedCanvasId, state.currentWorkingCanvasId, state.canvases, dispatch]);

  // TODO-later: Navigate Canvases functionality may be added back later
  // const handleNavigateCanvases = useCallback(
  //   (direction: "next" | "prev") => {
  //     const visibleCanvases = state.canvases
  //       .filter(() => true)
  //       .sort(
  //         (a, b) =>
  //           new Date(b.updatedAt || b.createdAt).getTime() -
  //           new Date(a.updatedAt || a.createdAt).getTime(),
  //       );
  //
  //     if (visibleCanvases.length === 0) return;
  //
  //     const currentIndex = state.selectedCanvasId
  //       ?
  //       visibleCanvases.findIndex((c) => c.id === state.selectedCanvasId)
  //       : -1;
  //
  //     let newIndex;
  //     if (direction === "next") {
  //       newIndex =
  //         currentIndex < visibleCanvases.length - 1 ? currentIndex + 1 : 0;
  //     } else {
  //       newIndex =
  //         currentIndex > 0 ? currentIndex - 1 : visibleCanvases.length - 1;
  //     }
  //
  //     const nextCanvas = visibleCanvases[newIndex];
  //     if (nextCanvas) {
  //       dispatch({ type: "SET_SELECTED_CANVAS", payload: nextCanvas.id });
  //       eventBus.emit(InternalEventTypes.CANVAS_SELECTED, nextCanvas);
  //       eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, nextCanvas);
  //     }
  //   },
  //   [state.canvases, state.selectedCanvasId, dispatch],
  // );

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
        } else if (state.projectContextMenu) {
          dispatch({ type: "SET_PROJECT_CONTEXT_MENU", payload: null });
        } else if (state.isCanvasDeleteModalOpen) {
          dispatch({ type: "SET_CANVAS_DELETE_MODAL_OPEN", payload: false });
        } else if (state.isRenameModalOpen) {
          dispatch({ type: "SET_RENAME_MODAL_OPEN", payload: false });
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

      // TODO-later: Navigate Canvases functionality may be added back later
      // Navigate Canvases: Ctrl/Cmd + Alt + Up/Down
      // if (
      //   ctrlCmdKey &&
      //   altKey &&
      //   !shiftKey &&
      //   (e.key === "ArrowUp" || e.key === "ArrowDown")
      // ) {
      //   e.preventDefault();
      //   e.stopPropagation();
      //   e.stopImmediatePropagation();
      //   handleNavigateCanvases(e.key === "ArrowDown" ? "next" : "prev");
      //   return;
      // }

      // Delete Canvas: Alt + Delete
      if (altKey && !ctrlCmdKey && !shiftKey && e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleDeleteSelected();
        return;
      }

      // Rename Canvas: F2 (works even when typing)
      if (!altKey && !ctrlCmdKey && !shiftKey && e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleRenameSelected();
        return;
      }

      // TODO Later
      if (isTyping()) return;

      // TODO-later: Navigate Canvases functionality may be added back later
      // Navigate Canvases: Ctrl/Cmd + Alt + Up/Down
      // if (
      //   ctrlCmdKey &&
      //   altKey &&
      //   !shiftKey &&
      //   (e.key === "ArrowUp" || e.key === "ArrowDown")
      // ) {
      //   e.preventDefault();
      //   e.stopPropagation();
      //   e.stopImmediatePropagation();
      //   handleNavigateCanvases(e.key === "ArrowDown" ? "next" : "prev");
      //   return;
      // }



    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    state.contextMenu,
    state.projectContextMenu,
    state.isSearchModalOpen,
    state.isHelpModalOpen,
    state.isRenameModalOpen,
    state.isCanvasDeleteModalOpen,
    isTyping,
    dispatch,
    onNewCanvas,
    onNewProject,
    onTogglePanel,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRenameSelected,
    // handleNavigateCanvases, // TODO-later: Commented out with navigate canvases functionality
    showHelpDialog,
    handleNewCanvasShortcut,
  ]);

  return getExtensionShortcuts();
}
