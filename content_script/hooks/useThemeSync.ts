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
          console.log('Theme detection - excalidraw-state:', state.theme);
          if (state.theme === 'dark' || state.theme === 'light') {
            return state.theme;
          }
        }

        // Method 2: Check appState in localStorage
        const excalidrawData = localStorage.getItem('excalidraw');
        if (excalidrawData) {
          const data = JSON.parse(excalidrawData);
          console.log('Theme detection - excalidraw appState:', data.appState?.theme);
          if (data.appState?.theme) {
            return data.appState.theme;
          }
        }

        // Method 3: System preference fallback
        const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        console.log('Theme detection - system preference:', systemDark ? 'dark' : 'light');
        if (systemDark) {
          return 'dark';
        }

        // Default to light (matches Excalidraw.com)
        console.log('Theme detection - using default: light');
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
          // Set data-theme attribute on document root for CSS variables to work globally
          document.documentElement.setAttribute('data-theme', detectedTheme);
          console.log(`Set document.documentElement data-theme to: ${detectedTheme}`);

          // Debug: Verify attribute was set
          const actualAttribute = document.documentElement.getAttribute('data-theme');
          console.log(`Verification - actual data-theme attribute: ${actualAttribute}`);
        } else {
          console.log(`No theme change needed, current: ${state.theme}, detected: ${detectedTheme}`);
        }
      } catch (error) {
        console.error('Error detecting theme:', error);
      } finally {
        setIsDetecting(false);
      }
    };

    // Initial theme detection
    console.log('Starting initial theme detection...');
    updateTheme();

    // Ensure document has the initial theme attribute set (fallback)
    setTimeout(() => {
      const currentAttribute = document.documentElement.getAttribute('data-theme');
      if (!currentAttribute) {
        const fallbackTheme = detectExcalidrawTheme();
        document.documentElement.setAttribute('data-theme', fallbackTheme);
        console.log(`Fallback: Set initial theme to ${fallbackTheme} (attribute was null)`);
      } else {
        console.log(`Initial theme attribute already set: ${currentAttribute}`);
      }
    }, 100);

    // Method 1: Use MutationObserver to watch for class changes
    themeObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const attributeName = mutation.attributeName;
          const target = mutation.target as Element;
          console.log(`DOM mutation detected: ${attributeName} on ${target.tagName}`);

          if (attributeName === 'class' || attributeName === 'data-theme') {
            shouldUpdate = true;
            console.log(`Theme-relevant attribute changed: ${attributeName}`);
          }
        }
      });

      if (shouldUpdate) {
        console.log('Triggering theme update due to DOM mutation');
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
        console.log(`Storage change detected for key: ${e.key}`);
        if (e.key === 'excalidraw-state' && e.newValue) {
          try {
            const newState = JSON.parse(e.newValue);
            console.log(`New excalidraw-state theme: ${newState.theme}`);
          } catch (error) {
            console.log('Could not parse new storage value');
          }
        }
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
    console.log(`Manual theme toggle: ${state.theme} → ${newTheme}`);
    dispatch({ type: 'SET_THEME', payload: newTheme });
    eventBus.emit(InternalEventTypes.THEME_CHANGED, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    console.log(`Manual toggle set data-theme to: ${newTheme}`);
  };

  // Expose force theme function
  const setTheme = (theme: 'light' | 'dark') => {
    if (theme !== state.theme) {
      console.log(`Manual theme set: ${state.theme} → ${theme}`);
      dispatch({ type: 'SET_THEME', payload: theme });
      eventBus.emit(InternalEventTypes.THEME_CHANGED, theme);
      document.documentElement.setAttribute('data-theme', theme);
      console.log(`Manual set data-theme to: ${theme}`);
    }
  };

  return {
    currentTheme: state.theme,
    isDetecting,
    toggleTheme,
    setTheme
  };
}
