/// <reference types="chrome"/>

import { Message } from "./types";

export const sendMessageToContent = async <T = void>(
  message: Message
): Promise<T | undefined> => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (tab.id) {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    return response;
  }
};

export const setStorage = <T>(key: string, value: T): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

export const getStorage = <T>(key: string): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const rawValue = result[key];
        try {
          const value = rawValue ? (JSON.parse(rawValue) as T) : undefined;
          resolve(value);
        } catch (e) {
          console.error(`Failed to parse JSON for key "${key}":`, rawValue, e);
          resolve(undefined);
        }
      }
    });
  });
};

export const getAllStorage = <T>(): Promise<{ [key: string]: T }> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(items as { [key: string]: T });
      }
    });
  });
};

export const removeStorage = (keys: string | string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

export const getAllKeys = (): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    getAllStorage()
      .then((items) => {
        resolve(Object.keys(items));
      })
      .catch((error) => {
        reject(error);
      });
  });
};
