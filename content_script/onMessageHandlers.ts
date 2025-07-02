// excalidrawUtils.ts

const STORAGE_KEY = "excalidraw";
const BADGE_CLASS = "excalidraw-file-badge";
const WARNING_MSG = "Please choose the file before start Drawing";
const STYLE_ID = "excalidraw-badge-styles";

// —– customize colors, fonts, spacing here —–
const CSS = `
.${BADGE_CLASS} {
  position: absolute;
  top: 12px;
  left: 20px;
  padding: 8px 14px;
  background-color: rgba(40, 44, 52, 0.85);
  color: #ffffff;
  font-family: "Roboto", Arial, sans-serif;
  font-size: 14px;
  font-weight: 300;
  border-radius: 6px;
  z-index: 1000;
}
.${BADGE_CLASS}.warning {
  font-style: italic;
  color: rgba(255, 255, 255, 0.6);
}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

async function removeBadge(): Promise<void> {
  document.querySelector(`.${BADGE_CLASS}`)?.remove();
}

function createBadge(name: string): HTMLDivElement {
  const badge = document.createElement("div");
  badge.classList.add(BADGE_CLASS);
  if (name === WARNING_MSG) badge.classList.add("warning");
  badge.textContent = name;
  return badge;
}

export const onLoadExcalidrawFile = async (): Promise<string> => {
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
};

export const onPushExcalidrawFile = async (data: string): Promise<void> => {
  window.localStorage.setItem(STORAGE_KEY, data);
  window.location.reload();
};

export const onPushFileNameToExcalidraw = async (
  fileName: string,
): Promise<void> => {
  ensureStyles();
  await removeBadge();
  const badge = createBadge(fileName);
  const container = document.querySelector(".App-menu");
  if (container) container.appendChild(badge);
  else console.error("Excalidraw .App-menu container not found");
};

export const onPullFileNameFromExcalidraw = async (): Promise<string> => {
  return document.querySelector(`.${BADGE_CLASS}`)?.textContent ?? "";
};
