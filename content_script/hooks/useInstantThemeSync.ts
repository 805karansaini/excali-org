import { useEffect, useRef, useCallback } from "react";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedAction } from "../../shared/types";
import React from "react";

interface UseInstantThemeSyncProps {
  theme: "light" | "dark";
  dispatch: React.Dispatch<UnifiedAction>;
}

/**
 * Simplified theme synchronization hook.
 * 
 * Uses two essential detection layers:
 * - Direct localStorage monitoring (primary)
 * - Optimized mutation observer (secondary)
 */
export function useInstantThemeSync({
  theme,
  dispatch,
}: UseInstantThemeSyncProps) {
  const currentThemeRef = useRef<"light" | "dark">(theme);
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  // Smart theme detection with caching
  const detectExcalidrawTheme = useCallback((): "light" | "dark" => {
    try {
      // Method 1: Official Excalidraw theme storage (PRIMARY)
      const excalidrawState = localStorage.getItem("excalidraw-state");
      if (excalidrawState) {
        const state = JSON.parse(excalidrawState);
        if (state.theme === "dark" || state.theme === "light") {
          return state.theme;
        }
      }

      // Method 2: Document data-theme attribute (SECONDARY)
      const documentTheme = document.documentElement.getAttribute("data-theme");
      if (documentTheme === "dark" || documentTheme === "light") {
        return documentTheme;
      }

      // Method 3: System preference fallback (TERTIARY)
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    } catch {
      // Silently fall back to current theme if detection fails
      return currentThemeRef.current;
    }
  }, []);

  // Instant theme update with event emission
  const updateThemeInstantly = useCallback(
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

  // Layer 1: Direct localStorage monitoring (ESSENTIAL)
  const setupDirectStorageMonitoring = useCallback(() => {
    let currentTheme = detectExcalidrawTheme();
    currentThemeRef.current = currentTheme;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "excalidraw-state" && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          if (newState.theme && newState.theme !== currentTheme) {
            currentTheme = newState.theme;
            updateThemeInstantly(currentTheme);
          }
        } catch {
          // Silently ignore parsing errors for storage events
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [detectExcalidrawTheme, updateThemeInstantly]);

  // Layer 2: Optimized mutation observer (ESSENTIAL)
  const setupMutationObserver = useCallback(() => {
    let updateScheduled = false;

    const throttledUpdate = () => {
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
          const detectedTheme = detectExcalidrawTheme();
          if (detectedTheme !== currentThemeRef.current) {
            updateThemeInstantly(detectedTheme);
          }
          updateScheduled = false;
        });
      }
    };

    const observer = new MutationObserver(() => {
      throttledUpdate();
    });

    // Observe document for theme attribute changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // Find and observe Excalidraw container if it exists
    const excalidrawContainer = document.querySelector(".excalidraw");
    if (excalidrawContainer) {
      observer.observe(excalidrawContainer, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [detectExcalidrawTheme, updateThemeInstantly]);

  // Setup detection layers
  useEffect(() => {
    // Clear any existing cleanup functions
    cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
    cleanupFunctionsRef.current = [];

    // Initial theme detection and setup
    const initialTheme = detectExcalidrawTheme();
    if (initialTheme !== currentThemeRef.current) {
      updateThemeInstantly(initialTheme);
    }

    // Layer 1: Direct localStorage monitoring
    const storageCleanup = setupDirectStorageMonitoring();
    cleanupFunctionsRef.current.push(storageCleanup);

    // Layer 2: Optimized mutation observer
    const mutationCleanup = setupMutationObserver();
    cleanupFunctionsRef.current.push(mutationCleanup);

    // Cleanup function
    return () => {
      cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, [
    detectExcalidrawTheme,
    updateThemeInstantly,
    setupDirectStorageMonitoring,
    setupMutationObserver,
  ]);

  // Update ref when prop changes
  useEffect(() => {
    currentThemeRef.current = theme;
  }, [theme]);
}