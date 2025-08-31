import { useEffect, useRef, useCallback } from "react";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedAction } from "../../shared/types";
import React from "react";

interface UseInstantThemeSyncProps {
  theme: "light" | "dark";
  dispatch: React.Dispatch<UnifiedAction>;
}

/**
 * Simple theme synchronization hook.
 * Syncs extension theme with Excalidraw by polling localStorage.
 */
export function useInstantThemeSync({
  theme,
  dispatch,
}: UseInstantThemeSyncProps) {
  const currentThemeRef = useRef<"light" | "dark">(theme);

  // Detect Excalidraw's current theme from localStorage
  const detectExcalidrawTheme = useCallback((): "light" | "dark" => {
    try {
      // Primary: Check excalidraw-theme localStorage key (what Excalidraw actually uses)
      const excalidrawTheme = localStorage.getItem("excalidraw-theme");
      if (excalidrawTheme === "dark") return "dark";
      if (excalidrawTheme === "light") return "light";

      // Secondary: Check excalidraw-state for theme
      const excalidrawState = localStorage.getItem("excalidraw-state");
      if (excalidrawState) {
        const state = JSON.parse(excalidrawState);
        if (state.theme === "dark" || state.theme === "light") {
          return state.theme;
        }
      }
    } catch {
      // Silently handle localStorage access errors
    }

    // Fallback: system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // Update theme when it changes
  const updateTheme = useCallback(
    (newTheme: "light" | "dark") => {
      if (newTheme !== currentThemeRef.current) {
        currentThemeRef.current = newTheme;
        dispatch({ type: "SET_THEME", payload: newTheme });
        document.documentElement.setAttribute("data-theme", newTheme);
        eventBus.emit(InternalEventTypes.THEME_CHANGED, newTheme);
      }
    },
    [dispatch]
  );

  // Simple polling to detect theme changes
  useEffect(() => {
    // Initial theme sync
    const initialTheme = detectExcalidrawTheme();
    if (initialTheme !== currentThemeRef.current) {
      updateTheme(initialTheme);
    }

    // Poll for theme changes every 200ms
    const interval = setInterval(() => {
      const detectedTheme = detectExcalidrawTheme();
      if (detectedTheme !== currentThemeRef.current) {
        updateTheme(detectedTheme);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [detectExcalidrawTheme, updateTheme]);

  // Update ref when prop changes
  useEffect(() => {
    currentThemeRef.current = theme;
  }, [theme]);
}
