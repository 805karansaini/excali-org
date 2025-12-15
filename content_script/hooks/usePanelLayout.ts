import React, { useCallback, useEffect, useRef, useState } from "react";
import { PANEL_CONSTANTS } from "../../shared/constants";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedAction } from "../../shared/types";

interface PanelLayoutOptions {
  panelWidth: number;
  isPanelPinned: boolean;
  isPanelVisible: boolean;
  contextMenuOpen: boolean;
  projectContextMenuOpen: boolean;
  dispatch: (action: UnifiedAction) => void;
  updatePanelSettings: (payload: { width?: number; isPinned?: boolean }) => void;
}

export const usePanelVisibility = ({
  isPanelPinned,
  isPanelVisible,
  contextMenuOpen,
  projectContextMenuOpen,
  dispatch,
  updatePanelSettings,
  suppressAutoHide = false,
}: Omit<PanelLayoutOptions, "panelWidth"> & { suppressAutoHide?: boolean }) => {
  const hideTimeoutRef = useRef<number>();
  const [isMouseOverPanel, setIsMouseOverPanel] = useState(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "SET_PANEL_VISIBLE", payload: false });
      eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
        isVisible: false,
      });
    }, PANEL_CONSTANTS.HIDE_DELAY_MS);
  }, [clearHideTimer, dispatch]);

  const handleMouseEnter = () => {
    clearHideTimer();
    setIsMouseOverPanel(true);
    dispatch({ type: "SET_PANEL_VISIBLE", payload: true });
    eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
      isVisible: true,
    });
  };

  const handleMouseLeave = () => {
    setIsMouseOverPanel(false);
    if (
      !isPanelPinned &&
      !contextMenuOpen &&
      !projectContextMenuOpen &&
      !suppressAutoHide
    ) {
      scheduleHide();
    }
  };

  const handleTogglePanel = useCallback(() => {
    // Show + pin if hidden
    if (!isPanelVisible) {
      dispatch({ type: "SET_PANEL_VISIBLE", payload: true });
      dispatch({ type: "SET_PANEL_PINNED", payload: true });
      updatePanelSettings({ isPinned: true });
      eventBus.emit(InternalEventTypes.PANEL_VISIBILITY_CHANGED, {
        isVisible: true,
      });
      eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
        isPinned: true,
      });
      return;
    }

    // If visible and pinned, allow auto-hide
    if (isPanelPinned) {
      dispatch({ type: "SET_PANEL_PINNED", payload: false });
      updatePanelSettings({ isPinned: false });
      eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
        isPinned: false,
      });
      if (!isMouseOverPanel) {
        scheduleHide();
      }
      return;
    }

    // Visible but unpinned -> pin it
    dispatch({ type: "SET_PANEL_PINNED", payload: true });
    updatePanelSettings({ isPinned: true });
    clearHideTimer();
    eventBus.emit(InternalEventTypes.PANEL_PINNED_CHANGED, {
      isPinned: true,
    });
  }, [
    isPanelVisible,
    isPanelPinned,
    isMouseOverPanel,
    dispatch,
    updatePanelSettings,
    clearHideTimer,
    scheduleHide,
  ]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  // Resume auto-hide after context menus close
  useEffect(() => {
    if (
      !contextMenuOpen &&
      !projectContextMenuOpen &&
      !isPanelPinned &&
      !isMouseOverPanel &&
      !suppressAutoHide
    ) {
      scheduleHide();
    } else {
      clearHideTimer();
    }
  }, [
    contextMenuOpen,
    projectContextMenuOpen,
    isPanelPinned,
    isMouseOverPanel,
    suppressAutoHide,
    scheduleHide,
    clearHideTimer,
  ]);

  return { handleMouseEnter, handleMouseLeave, handleTogglePanel, setIsMouseOverPanel };
};

export const usePanelResize = ({
  panelWidth,
  dispatch,
  updatePanelSettings,
}: Pick<PanelLayoutOptions, "panelWidth" | "dispatch" | "updatePanelSettings">) => {
  const [isResizing, setIsResizing] = useState(false);
  const [showWidthIndicator, setShowWidthIndicator] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(panelWidth);

  const clampWidth = useCallback(
    (width: number) =>
      Math.max(PANEL_CONSTANTS.MIN_WIDTH, Math.min(PANEL_CONSTANTS.MAX_WIDTH, width)),
    [],
  );

  const applyWidth = useCallback(
    (width: number) => {
      const clamped = clampWidth(width);
      dispatch({ type: "SET_PANEL_WIDTH", payload: clamped });
      setShowWidthIndicator(true);
    },
    [clampWidth, dispatch],
  );

  const handleResizeStart = useCallback(
    (clientX: number) => {
      setIsResizing(true);
      setShowWidthIndicator(true);
      resizeStartX.current = clientX;
      resizeStartWidth.current = panelWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [panelWidth],
  );

  const handleResizeMove = useCallback(
    (clientX: number) => {
      if (!isResizing) return;
      const deltaX = clientX - resizeStartX.current;
      applyWidth(resizeStartWidth.current + deltaX);
    },
    [isResizing, applyWidth],
  );

  const endResize = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    updatePanelSettings({ width: panelWidth });
    setTimeout(() => setShowWidthIndicator(false), PANEL_CONSTANTS.WIDTH_INDICATOR_TIMEOUT_MS);
    eventBus.emit(InternalEventTypes.PANEL_WIDTH_CHANGED, { width: panelWidth });
  }, [isResizing, panelWidth, updatePanelSettings]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => handleResizeMove(e.clientX);
    const handleMouseUp = () => endResize();
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      handleResizeMove(touch.clientX);
    };
    const handleTouchEnd = () => endResize();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isResizing, handleResizeMove, endResize]);

  const handleMouseResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleResizeStart(e.clientX);
    },
    [handleResizeStart],
  );

  const handleTouchResizeStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      handleResizeStart(touch.clientX);
    },
    [handleResizeStart],
  );

  const handleKeyboardResize = useCallback(
    (direction: "left" | "right") => {
      const delta = direction === "left" ? -20 : 20;
      applyWidth(panelWidth + delta);
      updatePanelSettings({ width: clampWidth(panelWidth + delta) });
      setTimeout(() => setShowWidthIndicator(false), PANEL_CONSTANTS.WIDTH_INDICATOR_TIMEOUT_MS);
    },
    [panelWidth, applyWidth, updatePanelSettings, clampWidth],
  );

  return {
    isResizing,
    showWidthIndicator,
    handleMouseResizeStart,
    handleTouchResizeStart,
    handleKeyboardResize,
  };
};
