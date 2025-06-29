import { useEffect, useState } from 'react';
import { useUnifiedState } from '../context/UnifiedStateProvider';
import { eventBus, InternalEventTypes } from '../messaging/InternalEventBus';

/**
 * Hook to synchronize panel theme with Excalidraw's theme
 */
export function useThemeSync() {
  const { state, dispatch } = useUnifiedState();
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    let themeObserver: MutationObserver | null = null;
    let intervalId: number | null = null;

    const detectExcalidrawTheme = (): 'light' | 'dark' => {
      try {
        // Method 1: Official Excalidraw theme storage
        const excalidrawState = localStorage.getItem('excalidraw-state');
        if (excalidrawState) {
          const state = JSON.parse(excalidrawState);
          if (state.theme === 'dark' || state.theme === 'light') {
            return state.theme;
          }
        }

        // Method 2: Check appState in localStorage
        const excalidrawData = localStorage.getItem('excalidraw');
        if (excalidrawData) {
          const data = JSON.parse(excalidrawData);
          if (data.appState?.theme) {
            return data.appState.theme;
          }
        }

        // Method 3: System preference fallback
        if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }

        // Default to light (matches Excalidraw.com)
        return 'light';
      } catch (error) {
        console.error('Theme detection failed:', error);
        return 'light'; // Safe fallback
      }
    };

    const updateTheme = () => {
      if (isDetecting) return;

      setIsDetecting(true);

      try {
        const detectedTheme = detectExcalidrawTheme();

        if (detectedTheme !== state.theme) {
          console.log(`Theme change detected: ${state.theme} → ${detectedTheme}`);
          dispatch({ type: 'SET_THEME', payload: detectedTheme });
          eventBus.emit(InternalEventTypes.THEME_CHANGED, detectedTheme);
          // Set data-theme attribute on our root for CSS variables
          const panelRoot = document.getElementById('excalidraw-file-manager-panel');
          if (panelRoot) {
            panelRoot.setAttribute('data-theme', detectedTheme);
          }
        }
      } catch (error) {
        console.error('Error detecting theme:', error);
      } finally {
        setIsDetecting(false);
      }
    };

    // Initial theme detection
    updateTheme();

    // Method 1: Use MutationObserver to watch for class changes
    themeObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const attributeName = mutation.attributeName;
          if (attributeName === 'class' || attributeName === 'data-theme') {
            shouldUpdate = true;
          }
        }
      });

      if (shouldUpdate) {
        // Debounce the update
        setTimeout(updateTheme, 100);
      }
    });

    // Observe changes on relevant elements
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // Also observe the main Excalidraw container if it exists
    const excalidrawContainer = document.querySelector('.excalidraw');
    if (excalidrawContainer) {
      themeObserver.observe(excalidrawContainer, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
      });
    }

    // Method 2: Periodic check as fallback
    intervalId = setInterval(updateTheme, 2000);

    // Method 3: Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setTimeout(updateTheme, 100);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }

    // Method 4: Listen for storage events (in case theme is stored)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'excalidraw-theme' || e.key === 'theme' || e.key === 'excalidraw-state') {
        setTimeout(updateTheme, 100);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Method 5: Listen for custom events that might indicate theme change
    const handleCustomThemeEvent = () => {
      setTimeout(updateTheme, 100);
    };

    window.addEventListener('theme-changed', handleCustomThemeEvent);
    window.addEventListener('excalidraw-theme-changed', handleCustomThemeEvent);

    // Cleanup
    return () => {
      if (themeObserver) {
        themeObserver.disconnect();
      }

      if (intervalId) {
        clearInterval(intervalId);
      }

      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }

      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('theme-changed', handleCustomThemeEvent);
      window.removeEventListener('excalidraw-theme-changed', handleCustomThemeEvent);
    };
  }, [state.theme, dispatch, isDetecting]);

  // Expose manual theme toggle function
  const toggleTheme = () => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    dispatch({ type: 'SET_THEME', payload: newTheme });
    eventBus.emit(InternalEventTypes.THEME_CHANGED, newTheme);
  };

  // Expose force theme function
  const setTheme = (theme: 'light' | 'dark') => {
    if (theme !== state.theme) {
      dispatch({ type: 'SET_THEME', payload: theme });
      eventBus.emit(InternalEventTypes.THEME_CHANGED, theme);
    }
  };

  return {
    currentTheme: state.theme,
    isDetecting,
    toggleTheme,
    setTheme
  };
}
