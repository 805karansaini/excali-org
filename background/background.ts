/// <reference types="chrome"/>

const registerEventListeners = () => {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const removeFileNameDiv = () => {
            const element = document.querySelector(".file-name-div");
            if (element) element.remove();
          };

          removeFileNameDiv();

          const fileNameDiv = document.createElement("div");
          fileNameDiv.classList.add("file-name-div");
          fileNameDiv.textContent =
            "Please choose the file before start Drawing";

          fileNameDiv.style.position = "absolute";
          fileNameDiv.style.top = "5px";
          fileNameDiv.style.left = "48px";
          fileNameDiv.style.padding = "7px 12px";
          fileNameDiv.style.backgroundColor = "rgba(35, 35, 41)";
          fileNameDiv.style.color = "rgba(222, 222, 227, 0.5)";
          fileNameDiv.style.fontFamily = "Roboto, Arial, sans-serif";
          fileNameDiv.style.fontWeight = "200";
          fileNameDiv.style.fontSize = "12px";
          fileNameDiv.style.fontStyle = "italic";
          fileNameDiv.style.zIndex = "1000";

          const excalidrawContainer = document.querySelector(".App-menu");

          if (excalidrawContainer) {
            excalidrawContainer.appendChild(fileNameDiv);
          } else {
            console.error("Excalidraw App-menu div not found.");
          }
        },
      });
    }
  });
};

(() => {
  registerEventListeners();
})();
