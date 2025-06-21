/// <reference types="chrome"/>

import { 
  onLoadExcalidrawFile,
  onPushExcalidrawFile, 
  onPushFileNameToExcalidraw,
  onPullFileNameFromExcalidraw 
} from './onMessageHandlers';

import { MessageTypes, Message } from '../shared/types';

// Message handler for communication with background script
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    const handleMessage = async () => {
      try {
        switch (message.type) {
          case MessageTypes.LOAD_EXCALIDRAW_FILE:
            return await onLoadExcalidrawFile();
          
          case MessageTypes.PUSH_EXCALIDRAW_FILE:
            await onPushExcalidrawFile(message.body?.data as string);
            return { success: true };
          
          case MessageTypes.PUSH_CURRENT_WORKING_FILE_NAME:
            await onPushFileNameToExcalidraw(message.body?.fileName as string);
            return { success: true };
          
          case MessageTypes.PULL_CURRENT_WORKING_FILE_NAME:
            return await onPullFileNameFromExcalidraw();
          
          default:
            throw new Error(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error('Content script message handler error:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    handleMessage()
      .then(sendResponse)
      .catch(error => {
        console.error('Message handler promise error:', error);
        sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
      });

    return true; // Keep message channel open for async response
  }
);

// Initialize content script
console.log('Excali Organizer content script loaded');