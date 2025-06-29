export class ExcalidrawIntegration {
  private panelContainer: HTMLElement | null = null;
  private triggerZone: HTMLElement | null = null;
  private mutationObserver: MutationObserver | null = null;
  private isInitialized = false;

  /**
   * Initialize the Excalidraw integration
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Excalidraw integration...');

      // Wait for Excalidraw to be fully ready
      await this.waitForExcalidrawReady();

      // Setup mutation observer to detect Excalidraw changes
      this.setupExcalidrawObserver();

      this.isInitialized = true;
      console.log('Excalidraw integration initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Excalidraw integration:', error);
      throw error;
    }
  }

  /**
   * Wait for Excalidraw's DOM to be ready
   */
  async waitForExcalidrawReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 60; // 30 seconds max wait
      let attempts = 0;

      const checkReady = () => {
        attempts++;

        // Check for multiple Excalidraw indicators
        const indicators = [
          document.querySelector('.App-menu'),
          document.querySelector('.App'),
          document.querySelector('[data-testid="canvas"]'),
          document.querySelector('.excalidraw')
        ];

        const hasValidIndicators = indicators.some(indicator => indicator !== null);
        const isCorrectDomain = window.location.href.includes('excalidraw.com');

        if (hasValidIndicators && isCorrectDomain) {
          resolve();
          return;
        }

        if (attempts >= maxAttempts) {
          reject(new Error('Excalidraw not ready - timeout reached'));
          return;
        }

        setTimeout(checkReady, 500);
      };

      checkReady();
    });
  }

  /**
   * Create the panel container DOM element
   */
  createPanelContainer(): HTMLElement | null {
    try {
      // Clean up any existing panels first
      this.cleanup();

      if (this.panelContainer) {
        // Return existing container
        return this.panelContainer;
      }

      // Create simple container for React to mount into
      // EnhancedAutoHidePanel will handle all styling and behavior
      const container = document.createElement('div');
      container.id = 'excali-org-panel';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        z-index: 999999;
        pointer-events: none;
      `;

      // Inject into DOM
      document.body.appendChild(container);

      this.panelContainer = container;

      console.log('Panel container created successfully');
      return container;

    } catch (error) {
      console.error('Failed to create panel container:', error);
      return null;
    }
  }


  /**
   * Setup mutation observer to detect Excalidraw DOM changes
   */
  private setupExcalidrawObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if Excalidraw structure changed significantly
        if (mutation.type === 'childList') {
          this.handleExcalidrawChange();
        }
      }
    });

    // Observe the main Excalidraw container
    const excalidrawRoot = document.querySelector('#root, .App') || document.body;

    this.mutationObserver.observe(excalidrawRoot, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Handle changes in Excalidraw's DOM structure
   */
  private handleExcalidrawChange(): void {
    // Ensure our panel is still properly positioned
    if (this.panelContainer && !document.body.contains(this.panelContainer)) {
      console.log('Panel container removed, re-injecting...');
      document.body.appendChild(this.panelContainer);
    }

    // Trigger zone handling moved to EnhancedAutoHidePanel
  }

  /**
   * Update file name display in Excalidraw
   */
  updateFileNameDisplay(fileName: string): void {
    try {
      // Remove existing file name display
      const existingDisplay = document.querySelector('.excalidraw-file-name-display');
      if (existingDisplay) {
        existingDisplay.remove();
      }

      // Create new file name display
      const fileNameDisplay = document.createElement('div');
      fileNameDisplay.className = 'excalidraw-file-name-display';
      fileNameDisplay.textContent = fileName;
      fileNameDisplay.style.cssText = `
        position: absolute;
        top: 5px;
        left: 48px;
        padding: 7px 12px;
        background: rgba(35, 35, 41, 0.9);
        color: rgba(222, 222, 227);
        font-family: 'Roboto', 'Arial', sans-serif;
        font-size: 12px;
        font-weight: 300;
        border-radius: 4px;
        z-index: 1000;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;

      // Find appropriate container and inject
      const appMenu = document.querySelector('.App-menu');
      if (appMenu) {
        appMenu.appendChild(fileNameDisplay);
      } else {
        document.body.appendChild(fileNameDisplay);
      }

    } catch (error) {
      console.error('Failed to update file name display:', error);
    }
  }

  /**
   * Detect current theme from Excalidraw
   */
  detectExcalidrawTheme(): 'light' | 'dark' {
    try {
      // Check for Excalidraw's theme indicators
      const html = document.documentElement;
      const body = document.body;

      // Look for theme classes or attributes
      if (html.classList.contains('theme-dark') ||
        body.classList.contains('theme-dark') ||
        html.getAttribute('data-theme') === 'dark') {
        return 'dark';
      }

      // Check computed styles
      const backgroundColor = window.getComputedStyle(body).backgroundColor;
      if (backgroundColor.includes('rgb(')) {
        const rgbValues = backgroundColor.match(/\d+/g);
        if (rgbValues && rgbValues.length >= 3) {
          const [r, g, b] = rgbValues.map(Number);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          return brightness < 128 ? 'dark' : 'light';
        }
      }

      // Default to light theme
      return 'light';

    } catch (error) {
      console.error('Failed to detect Excalidraw theme:', error);
      return 'light';
    }
  }

  /**
   * Check for conflicting extensions
   */
  checkForConflicts(): boolean {
    try {
      // Check for known conflicting elements
      const conflictingSelectors = [
        '.other-extension-panel',
        '#another-excalidraw-extension',
        '[data-extension="conflicting"]'
      ];

      for (const selector of conflictingSelectors) {
        if (document.querySelector(selector)) {
          console.warn(`Potential conflict detected: ${selector}`);
          return true;
        }
      }

      return false;

    } catch (error) {
      console.error('Failed to check for conflicts:', error);
      return false;
    }
  }

  /**
   * Get Excalidraw canvas data
   */
  getCanvasData(): any {
    try {
      // Try to access Excalidraw's data from localStorage
      const excalidrawData = localStorage.getItem('excalidraw');
      return excalidrawData ? JSON.parse(excalidrawData) : null;

    } catch (error) {
      console.error('Failed to get canvas data:', error);
      return null;
    }
  }

  /**
   * Set Excalidraw canvas data
   */
  setCanvasData(data: any): boolean {
    try {
      localStorage.setItem('excalidraw', JSON.stringify(data));

      // Trigger Excalidraw to reload the data
      window.dispatchEvent(new Event('storage'));

      return true;

    } catch (error) {
      console.error('Failed to set canvas data:', error);
      return false;
    }
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    try {
      // Clean up any orphaned DOM elements first
      const existingPanels = document.querySelectorAll('#excali-org-panel');
      existingPanels.forEach(panel => {
        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
      });

      // No trigger zone cleanup needed - EnhancedAutoHidePanel handles it

      // Remove DOM elements
      if (this.panelContainer && this.panelContainer.parentNode) {
        this.panelContainer.parentNode.removeChild(this.panelContainer);
        this.panelContainer = null;
      }

      // No triggerZone cleanup needed - handled by EnhancedAutoHidePanel

      // Disconnect mutation observer
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }

      // Remove file name display
      const fileNameDisplay = document.querySelector('.excalidraw-file-name-display');
      if (fileNameDisplay && fileNameDisplay.parentNode) {
        fileNameDisplay.parentNode.removeChild(fileNameDisplay);
      }

      this.isInitialized = false;

      console.log('Excalidraw integration cleanup completed');

    } catch (error) {
      console.error('Error during Excalidraw integration cleanup:', error);
    }
  }

  /**
   * Set panel visibility programmatically
   */
  setPanelVisibility(isVisible: boolean): void {
    if (!this.panelContainer) return;

    try {
      this.panelContainer.style.transform = isVisible ? 'translateX(0)' : 'translateX(-100%)';
    } catch (error) {
      console.error('Failed to set panel visibility:', error);
    }
  }

  /**
   * Get the panel container element
   */
  getPanelContainer(): HTMLElement | null {
    return this.panelContainer;
  }

  /**
   * Get integration statistics for debugging
   */
  getStats(): {
    isInitialized: boolean;
    hasPanelContainer: boolean;
    hasTriggerZone: boolean;
    theme: 'light' | 'dark';
    hasConflicts: boolean;
    canvasDataExists: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      hasPanelContainer: this.panelContainer !== null,
      hasTriggerZone: this.triggerZone !== null,
      theme: this.detectExcalidrawTheme(),
      hasConflicts: this.checkForConflicts(),
      canvasDataExists: this.getCanvasData() !== null
    };
  }

  /**
   * Check if integration is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.panelContainer !== null;
  }
}
