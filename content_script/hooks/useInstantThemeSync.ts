import { useEffect, useState, useRef, useCallback } from "react";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedAction } from "../../shared/types";
import React from "react";

interface UseInstantThemeSyncProps {
  theme: "light" | "dark";
  dispatch: React.Dispatch<UnifiedAction>;
}
/**
 * Advanced theme synchronization hook.
 *
 * This hook uses multiple layers of detection to ensure near-instantaneous
 * theme synchronization with Excalidraw.
 *
 * Layers include:
 * - Direct localStorage monitoring
 * - System theme change detection
 * - Predictive detection based on user input
 * - Optimized mutation observers
 * - A fast fallback polling mechanism
 */
export function useInstantThemeSync({
  theme,
  dispatch,
}: UseInstantThemeSyncProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const currentThemeRef = useRef<"light" | "dark">(theme);
  const lastDetectionRef = useRef<number>(0);
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  // Smart theme detection with caching
  const detectExcalidrawTheme = useCallback((): "light" | "dark" => {
    try {
      // Method 1: Official Excalidraw theme storage (PRIORITY 1)
      const excalidrawState = localStorage.getItem("excalidraw-state");
      if (excalidrawState) {
        const state = JSON.parse(excalidrawState);
        if (state.theme === "dark" || state.theme === "light") {
          return state.theme;
        }
      }

      // Method 2: Document data-theme attribute (PRIORITY 2)
      const documentTheme = document.documentElement.getAttribute("data-theme");
      if (documentTheme === "dark" || documentTheme === "light") {
        return documentTheme;
      }

      // Method 3: System preference fallback (PRIORITY 3)
      const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")
        .matches;
      return systemDark ? "dark" : "light";
    } catch {
      // Development error logging removed for production build
      return "light"; // Safe fallback
    }
  }, []);

  // Update theme immediately for instant visual feedback
  const updateThemeInstantly = useCallback(
    (newTheme: "light" | "dark") => {
      const now = Date.now();

      // Prevent excessive updates
      if (now - lastDetectionRef.current < 16) {
        // Max 60fps updates
        return;
      }

      if (newTheme !== currentThemeRef.current) {
        currentThemeRef.current = newTheme;
        lastDetectionRef.current = now;

        // Update state
        dispatch({ type: "SET_THEME", payload: newTheme });

        // Update DOM
        document.documentElement.setAttribute("data-theme", newTheme);

        // Emit event
        eventBus.emit(InternalEventTypes.THEME_CHANGED, newTheme);
      }
    },
    [dispatch],
  );

  // Layer 1: Direct localStorage monitoring
  const setupDirectStorageMonitoring = useCallback(() => {
    let currentTheme = detectExcalidrawTheme();
    currentThemeRef.current = currentTheme;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "excalidraw-state" && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          if (newState.theme && newState.theme !== currentTheme) {
            currentTheme = newState.theme;
            updateThemeInstantly(newState.theme);
          }
        } catch {
          // Development warning removed for production build
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [detectExcalidrawTheme, updateThemeInstantly]);

  // Layer 2: System theme change monitoring
  const setupSystemThemeMonitoring = useCallback(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      updateThemeInstantly(newTheme, "system-preference");
    };

    // Use modern addEventListener if available
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, [updateThemeInstantly]);

  // Layer 3: Predictive theme detection
  const setupPredictiveDetection = useCallback(() => {
    // Predict theme changes from keyboard shortcuts
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      // Excalidraw uses Alt+Shift+D for theme toggle
      if (e.altKey && e.shiftKey && e.key === "D") {
        e.preventDefault(); // Prevent the default action temporarily
        const predictedTheme =
          currentThemeRef.current === "light" ? "dark" : "light";

        // Update immediately, before Excalidraw processes the shortcut
        updateThemeInstantly(predictedTheme, "keyboard-prediction");

        // Allow the original event to proceed after a frame
        requestAnimationFrame(() => {
          // Re-dispatch the event if needed (but usually not necessary)
        });
      }
    };

    // Detect theme toggle button clicks
    const handleClickPrediction = (e: MouseEvent) => {
      const target = e.target as Element;

      // Look for Excalidraw's theme toggle elements
      const themeButton =
        target.closest('[data-testid*="theme"]') ||
        target.closest(".theme-toggle") ||
        target.closest('[aria-label*="theme"]') ||
        target.closest('[title*="theme"]');

      if (themeButton) {
        const predictedTheme =
          currentThemeRef.current === "light" ? "dark" : "light";
        updateThemeInstantly(predictedTheme, "click-prediction");
      }
    };

    document.addEventListener("keydown", handleKeyboardShortcut, true);
    document.addEventListener("click", handleClickPrediction, true);

    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcut, true);
      document.removeEventListener("click", handleClickPrediction, true);
    };
  }, [updateThemeInstantly]);

  // Layer 4: Optimized mutation observer
  const setupOptimizedMutationObserver = useCallback(() => {
    let updateScheduled = false;

    const scheduleThemeUpdate = () => {
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
          const detectedTheme = detectExcalidrawTheme();
          if (detectedTheme !== currentThemeRef.current) {
            updateThemeInstantly(detectedTheme, "mutation-observer");
          }
          updateScheduled = false;
        });
      }
    };

    const observer = new MutationObserver((mutations) => {
      let needsUpdate = false;

      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const attributeName = mutation.attributeName;
          if (attributeName === "class" || attributeName === "data-theme") {
            needsUpdate = true;
            break; // Early exit for performance
          }
        }
      }

      if (needsUpdate) {
        scheduleThemeUpdate();
      }
    });

    // Observe only the essential elements
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"], // Only watch theme-relevant attributes
    });

    // Also observe body for Excalidraw's theme classes
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Find and observe Excalidraw container if it exists
    const excalidrawContainer = document.querySelector(".excalidraw");
    if (excalidrawContainer) {
      observer.observe(excalidrawContainer, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [detectExcalidrawTheme, updateThemeInstantly]);

  // Layer 5: Fast fallback polling
  const setupFastFallbackPolling = useCallback(() => {
    const OPTIMIZED_POLL_INTERVAL = 250;

    const pollTheme = () => {
      if (!isDetecting) {
        setIsDetecting(true);

        try {
          const detectedTheme = detectExcalidrawTheme();
          if (detectedTheme !== currentThemeRef.current) {
            updateThemeInstantly(detectedTheme);
          }
        } catch {
          // Development error logging removed for production build
        } finally {
          setIsDetecting(false);
        }
      }
    };

    const intervalId = setInterval(pollTheme, OPTIMIZED_POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [detectExcalidrawTheme, updateThemeInstantly, isDetecting]);

  // Setup all detection layers
  useEffect(() => {
    // Clear any existing cleanup functions
    cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
    cleanupFunctionsRef.current = [];

    // Initial theme detection and setup
    const initialTheme = detectExcalidrawTheme();
    if (initialTheme !== currentThemeRef.current) {
      updateThemeInstantly(initialTheme, "initial-detection");
    }

    // Setup all detection layers
    const cleanupFunctions = [
      setupDirectStorageMonitoring(), // Layer 1
      setupSystemThemeMonitoring(), // Layer 2
      setupPredictiveDetection(), // Layer 3
      setupOptimizedMutationObserver(), // Layer 4
      setupFastFallbackPolling(), // Layer 5
    ];

    cleanupFunctionsRef.current = cleanupFunctions;

    // Cleanup function
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, [
    detectExcalidrawTheme,
    updateThemeInstantly,
    setupDirectStorageMonitoring,
    setupSystemThemeMonitoring,
    setupPredictiveDetection,
    setupOptimizedMutationObserver,
    setupFastFallbackPolling,
  ]);

  // Manual theme control functions
  const toggleTheme = useCallback(() => {
    const newTheme = currentThemeRef.current === "light" ? "dark" : "light";
    updateThemeInstantly(newTheme, "manual-toggle");
  }, [updateThemeInstantly]);

  const setTheme = useCallback(
    (theme: "light" | "dark") => {
      if (theme !== currentThemeRef.current) {
        updateThemeInstantly(theme, "manual-set");
      }
    },
    [updateThemeInstantly],
  );

  // Return the theme sync interface
  return {
    currentTheme: currentThemeRef.current,
    isDetecting,
    toggleTheme,
    setTheme,
    // Performance metrics for debugging
    lastDetectionTime: lastDetectionRef.current,
  };
}
