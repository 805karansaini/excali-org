/// <reference types="chrome"/>

const registerEventListeners = () => {
  chrome.tabs.onUpdated.addListener((/*tabId, changeInfo, tab*/) => {
    // if (changeInfo.status === "complete" && tab.url) {
    // TODO: Implement if needed
    // }
  });
};

(() => {
  registerEventListeners();
})();
