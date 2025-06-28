/**
 * Unified Panel Application - Main React application for the embedded panel
 * Updated to use the AutoHidePanel component with unified state management
 */

import { useUnifiedState } from '../context/UnifiedStateProvider';
import { AutoHidePanel } from './AutoHidePanel';
import { UnifiedCanvas } from '../../shared/types';

export function UnifiedPanelApp() {
  const { createCanvas } = useUnifiedState();

  const handleNewCanvas = async () => {
    try {
      const canvas = await createCanvas({
        name: `Canvas ${Date.now()}`,
        elements: [],
        excalidraw: [],
        appState: {},
        lastModified: new Date().toISOString(),
      });
      
      console.log('New canvas created:', canvas.name);
    } catch (error) {
      console.error('Failed to create canvas:', error);
    }
  };

  const handleCanvasSelect = (canvas: UnifiedCanvas) => {
    console.log('Canvas selected:', canvas.name);
    // The actual loading will be handled by the event system
    // in the ExcalidrawDataBridge through the AutoHidePanel
  };

  return (
    <AutoHidePanel 
      onNewCanvas={handleNewCanvas}
      onCanvasSelect={handleCanvasSelect}
    />
  );
}